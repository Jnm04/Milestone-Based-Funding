import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mintCompletionNFT } from "@/services/xrpl/nft.service";
import { writeAuditLog } from "@/services/evm/audit.service";

export const maxDuration = 60;

/**
 * POST /api/nft/mint-for-contract
 * Manually mint a completion NFT for an already-completed contract/milestone
 * that is missing its NFT (e.g. because the auto-mint timed out).
 *
 * Body: { contractId, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();
    if (!contractId) {
      return NextResponse.json({ error: "contractId required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const isParty =
      contract.investorId === session.user.id || contract.startupId === session.user.id;
    if (!isParty) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let title: string;
    let amountUSD: string;
    let evmTxHash: string | null;
    let existingTokenId: string | null;

    if (milestoneId) {
      const ms = contract.milestones.find((m) => m.id === milestoneId);
      if (!ms) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      if (ms.status !== "COMPLETED") {
        return NextResponse.json({ error: "Milestone not completed yet" }, { status: 409 });
      }
      title = ms.title;
      amountUSD = ms.amountUSD.toString();
      evmTxHash = ms.evmTxHash ?? null;
      existingTokenId = ms.nftTokenId ?? null;
    } else {
      if (contract.status !== "COMPLETED") {
        return NextResponse.json({ error: "Contract not completed yet" }, { status: 409 });
      }
      title = contract.milestone;
      amountUSD = contract.amountUSD.toString();
      evmTxHash = contract.evmTxHash ?? null;
      existingTokenId = contract.nftTokenId ?? null;
    }

    if (existingTokenId) {
      return NextResponse.json({ ok: true, alreadyMinted: true, tokenId: existingTokenId });
    }

    const nft = await mintCompletionNFT({
      contractId,
      milestoneTitle: title,
      amountUSD,
      completedAt: new Date(),
      evmTxHash,
    });

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
      metadata: { tokenId: nft.tokenId, txHash: nft.txHash, explorerUrl: nft.explorerUrl, manual: true },
    });

    return NextResponse.json({ ok: true, tokenId: nft.tokenId, explorerUrl: nft.explorerUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nft/mint-for-contract]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
