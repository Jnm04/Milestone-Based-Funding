import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { runCollectorForMilestone } from "@/services/ai/proof-collector.service";

export const maxDuration = 60;

/**
 * GET /api/cron/proof-collector
 * Vercel Cron Job — runs daily at 08:00 UTC.
 * Finds FUNDED milestones whose deadline is within the next 48 hours
 * and that have at least one agent connector configured (GitHub or Stripe).
 * For each: collects evidence, creates a DRAFT proof, emails the startup.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const milestones = await prisma.milestone.findMany({
    where: {
      status: "FUNDED",
      cancelAfter: { gte: now, lte: in48h },
      agentProofDraftId: null, // not yet collected
      OR: [
        { agentGithubRepo: { not: null } },
        { agentStripeKeyEnc: { not: null } },
      ],
    },
    select: { id: true, title: true, contractId: true },
  });

  const results = await Promise.allSettled(
    milestones.map(async (ms) => {
      const collected = await runCollectorForMilestone(ms.id);
      return { id: ms.id, title: ms.title, collected };
    })
  );

  const collected = results.filter((r) => r.status === "fulfilled" && r.value.collected).length;
  const skipped = results.filter((r) => r.status === "fulfilled" && !r.value.collected).length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    ok: true,
    total: milestones.length,
    collected,
    skipped,
    failed,
  });
}
