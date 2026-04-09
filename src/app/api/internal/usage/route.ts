import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [allTime, last30d] = await Promise.all([
    // All-time totals grouped by model
    prisma.apiUsage.groupBy({
      by: ["model"],
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      _count: true,
      orderBy: { _sum: { estimatedCostUsd: "desc" } },
    }),
    // Last 30 days grouped by day + model
    prisma.apiUsage.findMany({
      where: { createdAt: { gte: since30d } },
      select: { model: true, estimatedCostUsd: true, inputTokens: true, outputTokens: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Aggregate last30d by day
  const byDay = new Map<string, { date: string; cost: number; tokens: number }>();
  for (const row of last30d) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const existing = byDay.get(day) ?? { date: day, cost: 0, tokens: 0 };
    existing.cost += row.estimatedCostUsd;
    existing.tokens += row.inputTokens + row.outputTokens;
    byDay.set(day, existing);
  }

  // Total all-time cost
  const totalCostUsd = allTime.reduce((sum, r) => sum + (r._sum.estimatedCostUsd ?? 0), 0);
  const totalTokens  = allTime.reduce((sum, r) => sum + (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0), 0);
  const totalCalls   = allTime.reduce((sum, r) => sum + r._count, 0);

  return NextResponse.json({
    totalCostUsd,
    totalTokens,
    totalCalls,
    byModel: allTime.map((r) => ({
      model:          r.model,
      calls:          r._count,
      inputTokens:    r._sum.inputTokens  ?? 0,
      outputTokens:   r._sum.outputTokens ?? 0,
      estimatedCostUsd: r._sum.estimatedCostUsd ?? 0,
    })),
    dailySeries: Array.from(byDay.values()),
  });
}
