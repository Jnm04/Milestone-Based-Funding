import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitFull, applyRateLimitHeaders, getClientIp } from "@/lib/rate-limit";

export const revalidate = 300; // cache 5 minutes

/**
 * GET /api/agent/:userId/stats
 * Public endpoint — no auth required.
 * Returns an agent's reputation stats derived from their contract history.
 * Useful for funder agents to assess a builder before creating a contract.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  const rl = await checkRateLimitFull(`agent-stats:${ip}`, 60, 60 * 1000);
  if (!rl.allowed) {
    const h: Record<string, string> = { "Retry-After": "60" };
    applyRateLimitHeaders(h, rl);
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: h });
  }

  const { userId } = await params;

  if (!userId || typeof userId !== "string" || userId.length > 64) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      agentVolumePaid: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [
    builderTotal,
    builderCompleted,
    funderTotal,
    confidenceAgg,
  ] = await Promise.all([
    // Contracts where user is the builder (startup side)
    prisma.contract.count({
      where: { startupId: userId, deletedAt: null },
    }),
    // Contracts where builder completed (VERIFIED or COMPLETED)
    prisma.contract.count({
      where: {
        startupId: userId,
        status: { in: ["VERIFIED", "COMPLETED"] },
        deletedAt: null,
      },
    }),
    // Contracts where user is the funder (investor side)
    prisma.contract.count({
      where: { investorId: userId, deletedAt: null },
    }),
    // Average AI confidence on approved proofs in builder's contracts
    prisma.proof.aggregate({
      where: {
        contract: { startupId: userId },
        aiDecision: "YES",
        aiConfidence: { not: null },
      },
      _avg: { aiConfidence: true },
    }),
  ]);

  const completionRate =
    builderTotal > 0 ? Math.round((builderCompleted / builderTotal) * 100) / 100 : null;

  const avgApprovalConfidence =
    confidenceAgg._avg.aiConfidence != null
      ? Math.round(confidenceAgg._avg.aiConfidence)
      : null;

  const rlHeaders: Record<string, string> = {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
  };
  applyRateLimitHeaders(rlHeaders, rl);

  return NextResponse.json(
    {
      userId: user.id,
      memberSince: user.createdAt.toISOString(),
      contractsAsBuilder: {
        total: builderTotal,
        completed: builderCompleted,
        completionRate,
      },
      contractsAsFunder: {
        total: funderTotal,
      },
      avgApprovalConfidence,
      totalVolumeUSD: user.agentVolumePaid.toString(),
    },
    { headers: rlHeaders }
  );
}
