import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/agent/reputation/[walletAddress]
// Public — no auth required. Returns an agent's on-chain-verifiable reputation.
// Rate limited: 60 req / min per IP.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-reputation:${ip}`, 60, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { walletAddress } = await params;

  const agent = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: {
      id:               true,
      name:             true,
      agentDiscoverable: true,
      agentSkills:      true,
      createdAt:        true,
    },
  });

  if (!agent) {
    return NextResponse.json(
      { error: "No agent found with that wallet address" },
      { status: 404 }
    );
  }

  // Fetch agent contracts where this user was the Builder (startup side)
  const contracts = await prisma.contract.findMany({
    where: {
      startupId:      agent.id,
      isAgentContract: true,
      deletedAt:       null,
    },
    select: {
      id:     true,
      status: true,
      milestones: {
        where: { status: { in: ["COMPLETED", "REJECTED"] } },
        select: {
          id:         true,
          title:      true,
          amountUSD:  true,
          status:     true,
          nftTokenId: true,
          nftTxHash:  true,
          createdAt:  true,
        },
      },
      auditLogs: {
        where: { event: { in: ["FUNDS_RELEASED", "AI_DECISION", "NFT_MINTED"] } },
        select: {
          milestoneId: true,
          event:       true,
          xrplTxHash:  true,
          createdAt:   true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Flatten milestones with their per-milestone audit logs
  type MilestoneRow = {
    id: string;
    title: string;
    amountUSD: { toString(): string };
    status: string;
    nftTokenId: string | null;
    nftTxHash: string | null;
    createdAt: Date;
    contractId: string;
  };

  const allMilestones: MilestoneRow[] = contracts.flatMap((c) =>
    c.milestones.map((m) => ({ ...m, contractId: c.id }))
  );

  const completed = allMilestones.filter((m) => m.status === "COMPLETED");
  const rejected  = allMilestones.filter((m) => m.status === "REJECTED");
  const total     = completed.length + rejected.length;
  const successRate = total > 0 ? completed.length / total : null;

  const totalRlusdReleased = completed.reduce(
    (sum, m) => sum + Number(m.amountUSD),
    0
  );

  // Build a flat map of auditLogs keyed by milestoneId for quick lookup
  const auditByMilestone: Record<string, { event: string; xrplTxHash: string | null }[]> = {};
  for (const c of contracts) {
    for (const log of c.auditLogs) {
      if (!log.milestoneId) continue;
      if (!auditByMilestone[log.milestoneId]) {
        auditByMilestone[log.milestoneId] = [];
      }
      auditByMilestone[log.milestoneId].push({ event: log.event, xrplTxHash: log.xrplTxHash });
    }
  }

  const milestoneProofs = completed.map((m) => {
    const logs = auditByMilestone[m.id] ?? [];
    const aiLog      = logs.find((l) => l.event === "AI_DECISION");
    const releaseLog = logs.find((l) => l.event === "FUNDS_RELEASED");
    const nftLog     = logs.find((l) => l.event === "NFT_MINTED");

    return {
      milestoneId:  m.id,
      contractId:   m.contractId,
      title:        m.title,
      amountUSD:    Number(m.amountUSD).toFixed(2),
      completedAt:  m.createdAt,
      nftTokenId:   m.nftTokenId ?? null,
      proofs: {
        aiDecision:    aiLog?.xrplTxHash      ?? null,
        fundsReleased: releaseLog?.xrplTxHash ?? null,
        nftMinted:     nftLog?.xrplTxHash     ?? m.nftTxHash ?? null,
      },
    };
  });

  const skills: string[] = agent.agentSkills
    ? (JSON.parse(agent.agentSkills) as string[])
    : [];

  return NextResponse.json({
    walletAddress,
    agentId:      agent.id,
    name:         agent.name ?? null,
    memberSince:  agent.createdAt,
    discoverable: agent.agentDiscoverable,
    skills,
    stats: {
      milestonesCompleted: completed.length,
      milestonesRejected:  rejected.length,
      totalRlusdReleased:  totalRlusdReleased.toFixed(2),
      successRate,
    },
    milestones: milestoneProofs,
  });
}
