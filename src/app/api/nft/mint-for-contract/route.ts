import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { mintCompletionNFT } from "@/services/xrpl/nft.service";
import { writeAuditLog } from "@/services/evm/audit.service";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
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

  const isParty = contract.investorId === session.user.id || contract.startupId === session.user.id;
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
    if (ms.status !== "COMPLETED") return NextResponse.json({ error: "Milestone not completed yet" }, { status: 409 });
    title = ms.title;
    amountUSD = ms.amountUSD.toString();
    evmTxHash = ms.evmTxHash ?? null;
    existingTokenId = ms.nftTokenId ?? null;
  } else {
    if (contract.status !== "COMPLETED") return NextResponse.json({ error: "Contract not completed yet" }, { status: 409 });
    title = contract.milestone;
    amountUSD = contract.amountUSD.toString();
    evmTxHash = contract.evmTxHash ?? null;
    existingTokenId = contract.nftTokenId ?? null;
  }

  // Already minted and saved in DB
  if (existingTokenId && existingTokenId !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyMinted: true, tokenId: existingTokenId, title, amountUSD });
  }

  // Optimistic lock: atomically claim the mint slot by writing "PENDING".
  // Only one concurrent request will win — others get count=0 and return early.
  const claimed = milestoneId
    ? await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: null }, data: { nftTokenId: "PENDING" } })
    : await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: null }, data: { nftTokenId: "PENDING" } });

  if (claimed.count === 0) {
    return NextResponse.json({ ok: true, alreadyMinted: true });
  }

  // We own the lock — mint the NFT
  try {
    const nft = await mintCompletionNFT({ contractId, milestoneTitle: title, amountUSD, completedAt: new Date(), evmTxHash });

    if (milestoneId) {
      await prisma.milestone.update({ where: { id: milestoneId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash, nftImageUrl: nft.imageUrl ?? null } });
    } else {
      await prisma.contract.update({ where: { id: contractId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash, nftImageUrl: nft.imageUrl ?? null } });
    }

    await writeAuditLog({
      contractId,
      milestoneId: milestoneId ?? undefined,
      event: "NFT_MINTED",
      metadata: { tokenId: nft.tokenId, txHash: nft.txHash, explorerUrl: nft.explorerUrl },
    });

    return NextResponse.json({ ok: true, tokenId: nft.tokenId, txHash: nft.txHash, explorerUrl: nft.explorerUrl, imageUrl: nft.imageUrl ?? null, title, amountUSD });
  } catch (err) {
    // Release the lock so the user can retry
    if (milestoneId) {
      await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    } else {
      await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nft/mint-for-contract]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
