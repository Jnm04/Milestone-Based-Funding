import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { releaseMilestone } from "@/services/evm/escrow.service";
import { sendVerifiedEmail, sendMilestoneCompletedInvestorEmail } from "@/lib/email";
import { writeAuditLog } from "@/services/evm/audit.service";
import { mintCompletionNFT } from "@/services/xrpl/nft.service";

/**
 * POST /api/escrow/finish
 * Platform wallet calls releaseMilestone() on the EVM smart contract,
 * transferring RLUSD to the startup. No user signing required.
 *
 * Body: { contractId, milestoneId? }
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true, investor: true, startup: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const isParty =
      contract.investorId === session.user.id ||
      contract.startupId === session.user.id;
    if (!isParty) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status === "COMPLETED") {
      return NextResponse.json({ ok: true, action: "already_completed" });
    }

    if (contract.status !== "VERIFIED") {
      return NextResponse.json(
        { error: `Expected VERIFIED, got ${contract.status}` },
        { status: 409 }
      );
    }

    let milestoneOrder: number;
    let fulfillment: string | null;

    if (milestoneId) {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.status !== "VERIFIED") {
        return NextResponse.json(
          { error: `Expected milestone in VERIFIED, got ${milestone.status}` },
          { status: 409 }
        );
      }
      milestoneOrder = milestone.order;
      fulfillment = milestone.escrowFulfillment;
    } else {
      milestoneOrder = 0;
      fulfillment = contract.escrowFulfillment;
    }

    if (!fulfillment) {
      return NextResponse.json({ error: "Fulfillment key not found" }, { status: 500 });
    }

    // Platform wallet releases funds on-chain using the fulfillment key.
    // The smart contract verifies keccak256(fulfillment) == stored condition.
    const txHash = await releaseMilestone(contractId, milestoneOrder, fulfillment);
    console.log("[escrow/finish] Released on-chain:", txHash);

    if (milestoneId) {
      const completedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "COMPLETED", evmTxHash: txHash },
        include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
      });

      const milestones = completedMilestone.contract.milestones;
      const remaining = milestones.find(
        (m) => m.id !== milestoneId && !["COMPLETED", "EXPIRED"].includes(m.status)
      );

      let nextContractStatus: string;
      if (!remaining) {
        nextContractStatus = "COMPLETED";
      } else if (remaining.status === "FUNDED") {
        nextContractStatus = "FUNDED";
      } else {
        nextContractStatus = "AWAITING_ESCROW";
      }

      await prisma.contract.update({
        where: { id: contractId },
        data: { status: nextContractStatus as never },
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "COMPLETED" },
      });
    }

    const completedTitle = milestoneId
      ? contract.milestones.find((m) => m.id === milestoneId)?.title ?? contract.milestone
      : contract.milestone;
    const completedAmount = milestoneId
      ? (contract.milestones.find((m) => m.id === milestoneId)?.amountUSD ?? contract.amountUSD).toString()
      : contract.amountUSD.toString();

    await writeAuditLog({
      contractId,
      milestoneId: milestoneId ?? undefined,
      event: "FUNDS_RELEASED",
      metadata: { txHash, amountUSD: completedAmount, auto: false },
    });

    if (contract.startup?.notifyVerified) {
      void sendVerifiedEmail({
        to: contract.startup.email,
        contractId,
        milestoneTitle: completedTitle,
        amountUSD: completedAmount,
        txHash,
      });
    }

    if (contract.investor.notifyMilestoneCompleted) {
      void sendMilestoneCompletedInvestorEmail({
        to: contract.investor.email,
        contractId,
        milestoneTitle: completedTitle,
        amountUSD: completedAmount,
      });
    }

    // Mint XRPL completion certificate NFT — awaited with timeout so Vercel doesn't cut it off
    try {
      const nft = await Promise.race([
        mintCompletionNFT({
          contractId,
          milestoneTitle: completedTitle,
          amountUSD: completedAmount,
          completedAt: new Date(),
          evmTxHash: txHash,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("NFT mint timeout")), 15000)
        ),
      ]);
      console.log("[escrow/finish] Minted XRPL NFT:", nft.tokenId);
      if (milestoneId) {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash },
        });
      } else {
        await prisma.contract.update({
          where: { id: contractId },
          data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash },
        });
      }
      await writeAuditLog({
        contractId,
        milestoneId: milestoneId ?? undefined,
        event: "NFT_MINTED",
        xrplTxHash: nft.txHash,
        metadata: { tokenId: nft.tokenId, explorerUrl: nft.explorerUrl },
      });
    } catch (nftErr) {
      console.error("[escrow/finish] NFT minting failed (non-fatal):", nftErr);
    }

    return NextResponse.json({ ok: true, action: "completed", txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow finish error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
