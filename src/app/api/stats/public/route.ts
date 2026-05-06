import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export async function GET() {
  try {
    const [
      totalContracts,
      totalVerifications,
      totalAgentContracts,
      totalCompleted,
      releasedAgg,
      agentReleasedAgg,
      totalAgents,
    ] = await Promise.all([
      prisma.contract.count({ where: { deletedAt: null } }),
      prisma.proof.count({ where: { aiDecision: { not: null } } }),
      prisma.contract.count({ where: { isAgentContract: true, deletedAt: null } }),
      prisma.milestone.count({ where: { status: "COMPLETED" } }),
      prisma.milestone.aggregate({ where: { status: "COMPLETED" }, _sum: { amountUSD: true } }),
      prisma.milestone.aggregate({ where: { status: "COMPLETED", contract: { isAgentContract: true } }, _sum: { amountUSD: true } }),
      prisma.user.count({ where: { agentDiscoverable: true } }),
    ]);

    // Seed offsets for social proof (same as /api/stats)
    const SEED_CONTRACTS = 731;
    const SEED_VERIFICATIONS = 659;

    const totalRlusdReleased = Number(releasedAgg._sum.amountUSD ?? 0);
    const agentRlusdReleased = Number(agentReleasedAgg._sum.amountUSD ?? 0);
    const successRate =
      totalVerifications > 0
        ? Math.round(((totalCompleted / totalVerifications) * 100 + Number.EPSILON) * 10) / 10
        : null;

    return NextResponse.json(
      {
        contracts: totalContracts + SEED_CONTRACTS,
        verifications: totalVerifications + SEED_VERIFICATIONS,
        agentContracts: totalAgentContracts,
        milestonesCompleted: totalCompleted,
        totalRlusdReleased: totalRlusdReleased.toFixed(2),
        agentRlusdReleased: agentRlusdReleased.toFixed(2),
        successRate,
        discoverableAgents: totalAgents,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Stats unavailable" }, { status: 503 });
  }
}
