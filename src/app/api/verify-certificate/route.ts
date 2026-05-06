import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/verify-certificate?nftTokenId=...
// Public. Lets external systems verify a Cascrow NFT completion certificate.
// Returns the milestone and contract details if the NFT was minted by Cascrow.
export async function GET(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`verify-cert:${ip}`, 60, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const nftTokenId = searchParams.get("nftTokenId")?.trim();

  if (!nftTokenId) {
    return NextResponse.json(
      { error: "nftTokenId query parameter is required" },
      { status: 400 }
    );
  }

  // Check milestone-level NFT first, then contract-level
  const milestone = await prisma.milestone.findFirst({
    where: { nftTokenId },
    select: {
      id: true,
      title: true,
      amountUSD: true,
      status: true,
      nftTokenId: true,
      nftTxHash: true,
      nftImageUrl: true,
      createdAt: true,
      updatedAt: true,
      contract: {
        select: {
          id: true,
          status: true,
          isAgentContract: true,
          createdAt: true,
          startup: { select: { id: true, name: true, walletAddress: true } },
          investor: { select: { id: true, name: true } },
          auditLogs: {
            where: { event: { in: ["AI_DECISION", "FUNDS_RELEASED", "NFT_MINTED"] } },
            select: { event: true, xrplTxHash: true, createdAt: true },
            orderBy: { createdAt: "asc" },
            take: 10,
          },
        },
      },
    },
  });

  if (!milestone) {
    // Fallback: contract-level NFT
    const contract = await prisma.contract.findFirst({
      where: { nftTokenId },
      select: {
        id: true,
        milestone: true,
        amountUSD: true,
        status: true,
        nftTokenId: true,
        nftTxHash: true,
        nftImageUrl: true,
        isAgentContract: true,
        createdAt: true,
        startup: { select: { id: true, name: true, walletAddress: true } },
        investor: { select: { id: true, name: true } },
        auditLogs: {
          where: { event: { in: ["AI_DECISION", "FUNDS_RELEASED", "NFT_MINTED"] } },
          select: { event: true, xrplTxHash: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
    });

    if (!contract) {
      return NextResponse.json(
        { valid: false, error: "No Cascrow certificate found with this NFT token ID" },
        { status: 404 }
      );
    }

    const aiLog = contract.auditLogs.find((l) => l.event === "AI_DECISION");
    const releaseLog = contract.auditLogs.find((l) => l.event === "FUNDS_RELEASED");
    const nftLog = contract.auditLogs.find((l) => l.event === "NFT_MINTED");

    return NextResponse.json(
      {
        valid: true,
        type: "contract",
        nftTokenId: contract.nftTokenId,
        nftTxHash: contract.nftTxHash ?? null,
        nftImageUrl: contract.nftImageUrl ?? null,
        xrplExplorerUrl: contract.nftTxHash ? `https://xrpscan.com/tx/${contract.nftTxHash}` : null,
        contract: {
          id: contract.id,
          milestoneTitle: contract.milestone,
          amountUSD: Number(contract.amountUSD).toFixed(2),
          status: contract.status,
          isAgentContract: contract.isAgentContract,
          completedAt: contract.createdAt,
        },
        builder: contract.startup
          ? { id: contract.startup.id, name: contract.startup.name, walletAddress: contract.startup.walletAddress }
          : null,
        onChainProofs: {
          aiDecision: aiLog?.xrplTxHash ?? null,
          fundsReleased: releaseLog?.xrplTxHash ?? null,
          nftMinted: nftLog?.xrplTxHash ?? contract.nftTxHash ?? null,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
    );
  }

  const auditLogs = milestone.contract.auditLogs;
  const aiLog = auditLogs.find((l) => l.event === "AI_DECISION");
  const releaseLog = auditLogs.find((l) => l.event === "FUNDS_RELEASED");
  const nftLog = auditLogs.find((l) => l.event === "NFT_MINTED");

  return NextResponse.json(
    {
      valid: true,
      type: "milestone",
      nftTokenId: milestone.nftTokenId,
      nftTxHash: milestone.nftTxHash ?? null,
      nftImageUrl: milestone.nftImageUrl ?? null,
      xrplExplorerUrl: milestone.nftTxHash ? `https://xrpscan.com/tx/${milestone.nftTxHash}` : null,
      milestone: {
        id: milestone.id,
        title: milestone.title,
        amountUSD: Number(milestone.amountUSD).toFixed(2),
        status: milestone.status,
        completedAt: milestone.updatedAt,
      },
      contract: {
        id: milestone.contract.id,
        status: milestone.contract.status,
        isAgentContract: milestone.contract.isAgentContract,
      },
      builder: milestone.contract.startup
        ? {
            id: milestone.contract.startup.id,
            name: milestone.contract.startup.name,
            walletAddress: milestone.contract.startup.walletAddress,
          }
        : null,
      onChainProofs: {
        aiDecision: aiLog?.xrplTxHash ?? null,
        fundsReleased: releaseLog?.xrplTxHash ?? null,
        nftMinted: nftLog?.xrplTxHash ?? milestone.nftTxHash ?? null,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
  );
}
