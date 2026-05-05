import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/agent/my-contracts
// Returns all active contracts for the authenticated agent — both as Requester (investorId)
// and as Builder (startupId). Agents need this to resume work after restart or to poll
// contract state without knowing contract IDs in advance.
// Rate limited: 60 req / min per agent.
export async function GET(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  if (!(await checkRateLimit(`agent-my-contracts:${apiKeyCtx.userId}`, 60, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const roleParam = searchParams.get("role"); // "requester" | "builder" | null (both)

  const orClauses: { investorId: string }[] | { startupId: string }[] = [];

  const where: Record<string, unknown> = {
    deletedAt: null,
    isAgentContract: true,
  };

  if (roleParam === "requester") {
    where.investorId = apiKeyCtx.userId;
  } else if (roleParam === "builder") {
    where.startupId = apiKeyCtx.userId;
  } else {
    where.OR = [
      { investorId: apiKeyCtx.userId },
      { startupId: apiKeyCtx.userId },
    ];
  }

  void orClauses; // unused — kept for readability

  const contracts = await prisma.contract.findMany({
    where,
    select: {
      id:        true,
      status:    true,
      milestone: true,
      createdAt: true,
      investorId: true,
      startupId:  true,
      milestones: {
        select: {
          id:          true,
          title:       true,
          status:      true,
          amountUSD:   true,
          cancelAfter: true,
          order:       true,
        },
        orderBy: { order: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const result = contracts.map((c) => ({
    contractId:  c.id,
    status:      c.status,
    milestone:   c.milestone,
    createdAt:   c.createdAt,
    role:        c.investorId === apiKeyCtx.userId ? "requester" : "builder",
    milestones:  c.milestones.map((m) => ({
      milestoneId:  m.id,
      title:        m.title,
      status:       m.status,
      amountUSD:    Number(m.amountUSD).toFixed(2),
      cancelAfter:  m.cancelAfter,
      order:        m.order,
    })),
  }));

  return NextResponse.json({ contracts: result, total: result.length });
}
