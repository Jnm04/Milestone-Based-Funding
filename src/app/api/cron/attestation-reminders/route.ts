import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { sendAttestationDeadlineReminderEmail } from "@/lib/email";

/**
 * GET /api/cron/attestation-reminders
 * Finds ATTESTATION milestones with deadlines 7 days away (±12h window)
 * that have no attestation run yet for the current period, and emails the owner.
 * Secured by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isValidCronSecret(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);   // 6d from now
  const windowEnd   = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);   // 8d from now

  const milestones = await prisma.milestone.findMany({
    where: {
      contract: { mode: "ATTESTATION" },
      cancelAfter: { gte: windowStart, lte: windowEnd },
      dataSourceLockedAt: { not: null },
      status: { notIn: ["COMPLETED", "VERIFIED", "REJECTED", "EXPIRED"] },
    },
    include: {
      contract: {
        select: {
          id: true,
          milestone: true,
          investor: { select: { email: true, notifyMilestoneCompleted: true } },
        },
      },
      attestationEntries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  const sent: string[] = [];
  const skipped: string[] = [];

  for (const m of milestones) {
    const owner = m.contract.investor;
    if (!owner?.email) { skipped.push(m.id); continue; }

    const daysLeft = Math.ceil((m.cancelAfter.getTime() - now.getTime()) / 86_400_000);
    const lastRun  = m.attestationEntries[0];

    // Skip if already ran within last 24h (fresh result exists)
    if (lastRun && now.getTime() - lastRun.createdAt.getTime() < 24 * 60 * 60 * 1000) {
      skipped.push(m.id);
      continue;
    }

    try {
      await sendAttestationDeadlineReminderEmail({
        to: owner.email,
        contractId: m.contract.id,
        goalSetTitle: m.contract.milestone,
        milestoneTitle: m.title,
        deadlineAt: m.cancelAfter,
        daysLeft,
      });
      sent.push(m.id);
    } catch (err) {
      console.error(`[attestation-reminders] failed for milestone ${m.id}:`, err);
      skipped.push(m.id);
    }
  }

  return NextResponse.json({ sent: sent.length, skipped: skipped.length });
}
