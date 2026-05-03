import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-reputation:${ip}`, 60, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const { walletAddress } = await params;

  if (!walletAddress || walletAddress.length < 10) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { id: true, walletAddress: true },
  });

  if (!user) {
    return NextResponse.json({ error: "No agent found for this wallet address" }, { status: 404 });
  }

  // Fetch all terminal milestones where this user is the Builder.
  // Terminal = states where the outcome is final: COMPLETED, REJECTED, EXPIRED.
  const milestones = await prisma.milestone.findMany({
    where: {
      contract: { startupId: user.id },
      status: { in: ["COMPLETED", "REJECTED", "EXPIRED"] },
    },
    select: {
      id: true,
      contractId: true,
      title: true,
      amountUSD: true,
      nftTxHash: true,
      status: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Gather XRPL tx hashes from audit logs for completed milestones.
  // AI_DECISION proves the verdict; FUNDS_RELEASED proves the payout.
  // Both are written to XRPL by writeAuditLog and are independently verifiable.
  const completedIds = milestones
    .filter((m) => m.status === "COMPLETED")
    .map((m) => m.id);

  const auditLogs = completedIds.length > 0
    ? await prisma.auditLog.findMany({
        where: {
          milestoneId: { in: completedIds },
          event: { in: ["AI_DECISION", "FUNDS_RELEASED"] },
          xrplTxHash: { not: null },
        },
        select: { milestoneId: true, event: true, xrplTxHash: true },
      })
    : [];

  const proofsByMilestone = new Map<string, { aiDecision: string | null; fundsReleased: string | null }>();
  for (const log of auditLogs) {
    if (!log.milestoneId) continue;
    const entry = proofsByMilestone.get(log.milestoneId) ?? { aiDecision: null, fundsReleased: null };
    if (log.event === "AI_DECISION") entry.aiDecision = log.xrplTxHash ?? null;
    if (log.event === "FUNDS_RELEASED") entry.fundsReleased = log.xrplTxHash ?? null;
    proofsByMilestone.set(log.milestoneId, entry);
  }

  // Success rate uses COMPLETED + REJECTED as the denominator — EXPIRED milestones
  // are excluded because the Builder may not have been at fault (e.g. Requester set
  // an impossible deadline or cancelled before proof was submitted).
  const completed = milestones.filter((m) => m.status === "COMPLETED");
  const rejected = milestones.filter((m) => m.status === "REJECTED");
  const evaluated = completed.length + rejected.length;

  const totalVerified = completed.length;
  const successRate = evaluated > 0 ? Math.round((totalVerified / evaluated) * 1000) / 1000 : null;
  const totalRlusdReleased = completed
    .reduce((sum, m) => sum + Number(m.amountUSD), 0)
    .toFixed(2);

  return NextResponse.json({
    walletAddress: user.walletAddress,
    totalVerified,
    totalRlusdReleased,
    successRate,
    milestones: completed.map((m) => {
      const proofs = proofsByMilestone.get(m.id) ?? { aiDecision: null, fundsReleased: null };
      return {
        contractId: m.contractId,
        milestoneId: m.id,
        title: m.title,
        amountUSD: m.amountUSD.toString(),
        completedAt: m.updatedAt.toISOString(),
        xrplProofs: {
          aiDecision: proofs.aiDecision,
          fundsReleased: proofs.fundsReleased,
          nftMinted: m.nftTxHash ?? null,
        },
      };
    }),
  });
}
