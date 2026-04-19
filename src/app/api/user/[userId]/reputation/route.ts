import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ReputationCategory } from "@/services/ai/reputation.service";
import { REPUTATION_CATEGORIES } from "@/services/ai/reputation.service";

/**
 * GET /api/user/[userId]/reputation
 *
 * Public endpoint — no auth required.
 * Returns the startup's aggregated reputation score and their opted-in public milestone cards.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  // Verify the user exists and is a STARTUP
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, companyName: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "STARTUP") {
    return NextResponse.json({ error: "Reputation profiles are only available for startups" }, { status: 400 });
  }

  // Fetch the aggregated score (may be null if no milestones completed yet)
  const score = await prisma.reputationScore.findUnique({
    where: { userId },
  });

  // Fetch public milestone cards
  const publicMilestones = await prisma.milestone.findMany({
    where: {
      status: "COMPLETED",
      reputationPublic: true,
      reputationSummary: { not: null },
      contract: { startupId: userId },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      reputationSummary: true,
      reputationCategory: true,
      amountUSD: true,
      updatedAt: true,
    },
  });

  const emptyCategories: Record<ReputationCategory, number> = Object.fromEntries(
    REPUTATION_CATEGORIES.map((c) => [c, 0])
  ) as Record<ReputationCategory, number>;

  return NextResponse.json({
    userId: user.id,
    displayName: user.name ?? user.companyName ?? null,
    totalCompleted: score?.totalCompleted ?? 0,
    onTimeRate: score?.onTimeRate ?? null,
    avgAiConfidence: score?.avgAiConfidence ?? null,
    avgResubmissions: score?.avgResubmissions ?? null,
    categories: (score?.categories as Record<ReputationCategory, number>) ?? emptyCategories,
    publicCards: publicMilestones.map((ms) => ({
      milestoneId: ms.id,
      summary: ms.reputationSummary!,
      category: (ms.reputationCategory ?? "OTHER") as ReputationCategory,
      amountUSD: ms.amountUSD.toString(),
      completedAt: ms.updatedAt.toISOString(),
    })),
    lastCalculatedAt: score?.lastCalculatedAt.toISOString() ?? null,
  });
}
