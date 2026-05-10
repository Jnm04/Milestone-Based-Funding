import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyFundTx } from "@/services/evm/escrow.service";
import { sendFundedEmail } from "@/lib/email";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { getPostHogClient } from "@/lib/posthog-server";
import { ethers } from "ethers";

/**
 * POST /api/escrow/confirm
 * Called after the frontend submits a fundMilestone transaction via MetaMask.
 * Verifies the transaction on-chain and marks the milestone/contract as FUNDED.
 *
 * Body: { contractId, txHash, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 10 confirm attempts per investor per hour — a real MetaMask flow has at most 1-2
    if (!(await checkRateLimit(`escrow-confirm:${session.user.id}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const { contractId, txHash, milestoneId } = await request.json();

    if (!contractId || typeof contractId !== "string") {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }
    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "txHash must be a valid 0x-prefixed 64-char hex string" }, { status: 400 });
    }
    if (milestoneId !== undefined && typeof milestoneId !== "string") {
      return NextResponse.json({ error: "milestoneId must be a string" }, { status: 400 });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      include: { startup: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id) {
      return NextResponse.json({ error: "Not your contract" }, { status: 403 });
    }

    // Idempotent — already funded
    if (contract.status === "FUNDED") {
      return NextResponse.json({ ok: true, action: "already_funded" });
    }

    // Verify the transaction was mined successfully on-chain for this specific contract
    const { ok } = await verifyFundTx(txHash, contractId);
    if (!ok) {
      return NextResponse.json(
        { error: "Transaction not found or failed on-chain. Please wait and retry." },
        { status: 422 }
      );
    }

    let fundedMilestoneTitle = contract.milestone;
    let fundedAmountUSD = contract.amountUSD.toString();

    if (milestoneId) {
      // Wrap in a transaction to prevent a race condition where two concurrent
      // milestone-fund confirmations both read the milestone list and disagree
      // on whether all milestones are funded.
      const result = await prisma.$transaction(async (tx) => {
        // IDOR guard: ensure the milestoneId actually belongs to this contract
        const existing = await tx.milestone.findFirst({
          where: { id: milestoneId, contractId },
          select: { id: true },
        });
        if (!existing) {
          throw new Error("MILESTONE_CONTRACT_MISMATCH");
        }
        const updatedMilestone = await tx.milestone.update({
          where: { id: milestoneId },
          data: { status: "FUNDED", evmTxHash: txHash },
        });

        const allMilestones = await tx.milestone.findMany({
          where: { contractId },
          select: { status: true },
        });
        const allFunded = allMilestones.every((m) => m.status === "FUNDED");

        await tx.contract.update({
          where: { id: contractId },
          data: {
            status: allFunded ? "FUNDED" : "AWAITING_ESCROW",
            evmTxHash: allFunded ? txHash : undefined,
          },
        });

        return updatedMilestone;
      });

      fundedMilestoneTitle = result.title;
      fundedAmountUSD = result.amountUSD.toString();
    } else {
      await prisma.$transaction([
        prisma.contract.update({
          where: { id: contractId },
          data: { status: "FUNDED", evmTxHash: txHash },
        }),
      ]);
    }

    // keccak256 of the milestone title — anyone can verify the agreed criteria on-chain
    const milestoneHash = ethers.keccak256(ethers.toUtf8Bytes(fundedMilestoneTitle));

    await writeAuditLog({
      contractId,
      milestoneId: milestoneId ?? undefined,
      event: "ESCROW_FUNDED",
      actor: session.user.walletAddress ?? session.user.id,
      metadata: { txHash, amountUSD: fundedAmountUSD, milestoneHash },
    });

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: "escrow_funded",
      properties: {
        contract_id: contractId,
        milestone_id: milestoneId ?? null,
        amount_usd: fundedAmountUSD,
        tx_hash: txHash,
      },
    });

    // Email + webhook: milestone funded
    fireWebhook({
      investorId: contract.investorId,
      startupId: contract.startupId ?? undefined,
      event: "contract.funded",
      contractId,
      milestoneId: milestoneId ?? undefined,
      data: { txHash, amountUSD: fundedAmountUSD, milestoneTitle: fundedMilestoneTitle },
    }).catch((err) => console.error("[webhook] contract.funded failed:", err));

    if (contract.startup?.notifyFunded) {
      sendFundedEmail({
        to: contract.startup.email,
        contractId,
        milestoneTitle: fundedMilestoneTitle,
        amountUSD: fundedAmountUSD,
        startupId: contract.startupId ?? undefined,
      }).catch((err) => console.error("[email] sendFundedEmail failed:", err));
    }

    return NextResponse.json({ ok: true, action: "funded" });
  } catch (err) {
    console.error("Escrow confirm error:", err);
    return NextResponse.json({ error: "Escrow confirm failed" }, { status: 500 });
  }
}
