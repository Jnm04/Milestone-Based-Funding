import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAttestation } from "@/services/attestation/runner.service";
import { isValidCronSecret } from "@/lib/cron-auth";

function currentPeriod(scheduleType: string): string {
  const now = new Date();
  if (scheduleType === "MONTHLY") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (scheduleType === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  if (scheduleType === "ANNUAL") {
    return String(now.getFullYear());
  }
  return now.toISOString().slice(0, 10);
}

/**
 * GET /api/cron/run-attestations
 * Finds all ATTESTATION milestones with a scheduleNextRun in the past,
 * runs attestation for each, and advances the scheduleNextRun.
 * Secured by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isValidCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const due = await prisma.milestone.findMany({
    where: {
      dataSourceLockedAt: { not: null },
      scheduleNextRun: { lte: now },
      dataSourceType: { not: "MANUAL_REVIEW" },
      contract: { mode: "ATTESTATION" },
    },
    include: { contract: { select: { mode: true } } },
  });

  const results: { milestoneId: string; status: string; verdict?: string; error?: string }[] = [];

  for (const milestone of due) {
    try {
      const period = currentPeriod(milestone.scheduleType ?? "ONE_OFF");
      const result = await runAttestation(milestone.id, period, "CRON");

      // Advance next run date
      const next = new Date(now);
      if (milestone.scheduleType === "MONTHLY") {
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
      } else if (milestone.scheduleType === "QUARTERLY") {
        next.setMonth(next.getMonth() + 3);
        next.setDate(1);
      } else if (milestone.scheduleType === "ANNUAL") {
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(0);
        next.setDate(1);
      } else {
        // ONE_OFF: clear scheduleNextRun so it won't run again
        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { scheduleNextRun: null },
        });
        results.push({ milestoneId: milestone.id, status: "done", verdict: result.verdict });
        continue;
      }

      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { scheduleNextRun: next },
      });

      results.push({ milestoneId: milestone.id, status: "done", verdict: result.verdict });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron/run-attestations] failed for milestone ${milestone.id}:`, err);
      results.push({ milestoneId: milestone.id, status: "error", error: message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
