import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/agent/discover
// Public — no auth required.
// Query params:
//   skill     — filter by skill tag (case-insensitive substring match in JSON array)
//   minRate   — minimum success rate 0–1 (e.g. 0.8 = 80%)
//   limit     — max results, default 20, max 100
//   offset    — pagination offset, default 0
export async function GET(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-discover:${ip}`, 30, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const skill    = searchParams.get("skill")?.trim().toLowerCase() ?? null;
  const minRate  = searchParams.get("minRate")  ? parseFloat(searchParams.get("minRate")!) : null;
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);
  const offset   = parseInt(searchParams.get("offset") ?? "0", 10) || 0;

  if (minRate !== null && (isNaN(minRate) || minRate < 0 || minRate > 1)) {
    return NextResponse.json({ error: "minRate must be between 0 and 1" }, { status: 400 });
  }

  // Fetch all discoverable agents with their completed/rejected milestone counts
  const agents = await prisma.user.findMany({
    where: {
      agentDiscoverable: true,
      walletAddress: { not: null },
      // Skill filter: if provided, only agents whose agentSkills JSON contains the tag
      ...(skill
        ? { agentSkills: { contains: skill, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      walletAddress: true,
      agentSkills: true,
      createdAt: true,
      startupContracts: {
        where: { isAgentContract: true, deletedAt: null },
        select: {
          milestones: {
            where: { status: { in: ["COMPLETED", "REJECTED"] } },
            select: { status: true, amountUSD: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Compute reputation for each agent and optionally filter by minRate
  const results = agents
    .map((agent) => {
      const allMilestones = agent.startupContracts.flatMap((c) => c.milestones);
      const completed = allMilestones.filter((m) => m.status === "COMPLETED");
      const rejected  = allMilestones.filter((m) => m.status === "REJECTED");
      const total     = completed.length + rejected.length;
      const successRate = total > 0 ? completed.length / total : null;
      const totalRlusdReleased = completed.reduce((s, m) => s + Number(m.amountUSD), 0);

      let skills: string[] = [];
      try {
        skills = agent.agentSkills ? (JSON.parse(agent.agentSkills) as string[]) : [];
      } catch {
        skills = [];
      }

      return {
        agentId:             agent.id,
        name:                agent.name ?? null,
        walletAddress:       agent.walletAddress!,
        profileUrl:          `/agent/${agent.walletAddress}`,
        skills,
        stats: {
          milestonesCompleted: completed.length,
          totalRlusdReleased:  totalRlusdReleased.toFixed(2),
          successRate,
        },
        memberSince: agent.createdAt,
      };
    })
    .filter((a) => minRate === null || (a.stats.successRate !== null && a.stats.successRate >= minRate))
    // Sort by success rate desc, then by completed count desc
    .sort((a, b) => {
      const rA = a.stats.successRate ?? -1;
      const rB = b.stats.successRate ?? -1;
      if (rB !== rA) return rB - rA;
      return b.stats.milestonesCompleted - a.stats.milestonesCompleted;
    });

  const paginated = results.slice(offset, offset + limit);

  return NextResponse.json({
    agents: paginated,
    total:  results.length,
    limit,
    offset,
  });
}
