import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDeadlineReminderEmail } from "@/lib/email";
import { isValidCronSecret } from "@/lib/cron-auth";

/**
 * GET /api/cron/send-reminders
 * Daily Vercel Cron — sends deadline reminder emails to investors and startups.
 *
 * Sends reminders for milestones whose deadline falls within the next 48 hours
 * and that are still in an active (non-terminal) state.
 *
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  // Find milestones expiring in the next 48 hours that are still active
  const upcoming = await prisma.milestone.findMany({
    where: {
      cancelAfter: { gte: now, lte: in48h },
      status: { in: ["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"] },
    },
    include: {
      contract: {
        include: { investor: true, startup: true },
      },
      proofs: { select: { id: true }, take: 1 },
    },
  });

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    upcoming.flatMap((milestone) => {
      const { contract } = milestone;
      const hasProof = milestone.proofs.length > 0;
      const tasks = [];

      // Remind startup: submit proof (or confirmation it's in review)
      if (contract.startup?.email) {
        tasks.push(
          sendDeadlineReminderEmail({
            to: contract.startup.email,
            contractId: contract.id,
            milestoneTitle: milestone.title,
            deadlineAt: milestone.cancelAfter,
            role: "startup",
            hasProof,
          })
        );
      }

      // Remind investor only if no proof has been submitted yet
      if (!hasProof && contract.investor?.email && contract.investor.notifyProofSubmitted) {
        tasks.push(
          sendDeadlineReminderEmail({
            to: contract.investor.email,
            contractId: contract.id,
            milestoneTitle: milestone.title,
            deadlineAt: milestone.cancelAfter,
            role: "investor",
            hasProof: false,
          })
        );
      }

      return tasks;
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") sent++;
    else {
      failed++;
      console.error("[cron/send-reminders] Email failed:", r.reason);
    }
  }

  if (failed > 0) {
    console.error(`[cron/send-reminders] FAILURES: ${failed} emails failed to send`);
  }

  console.log(`[cron/send-reminders] Reminders sent: ${sent}, failed: ${failed}, milestones checked: ${upcoming.length}`);

  return NextResponse.json({ ok: true, milestones: upcoming.length, sent, failed });
}
