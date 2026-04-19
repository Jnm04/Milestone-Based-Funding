/**
 * GET /api/cron/progress-checkins
 * Vercel Cron Job — runs weekly (every Tuesday at 09:00 UTC).
 *
 * Finds all FUNDED milestones and sends a short "how is it going?" nudge
 * to the startup via email. No DB writes — purely a notification trigger.
 * Silently skips milestones where the startup has no email or the contract
 * has no startup assigned yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendProgressCheckinEmail } from "@/lib/email";
import { isValidCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all FUNDED milestones with a startup assigned
    const fundedMilestones = await prisma.milestone.findMany({
      where: { status: "FUNDED" },
      include: {
        contract: {
          include: { startup: { select: { email: true, name: true, companyName: true } } },
        },
      },
    });

    let sent = 0;
    let skipped = 0;

    const results = await Promise.allSettled(
      fundedMilestones.map(async (milestone) => {
        const startup = milestone.contract.startup;
        if (!startup?.email) {
          skipped++;
          return;
        }
        await sendProgressCheckinEmail({
          to: startup.email,
          contractId: milestone.contractId,
          milestoneTitle: milestone.title,
        });
        sent++;
      })
    );

    const errors = results.filter((r) => r.status === "rejected").length;
    console.log(`[cron/progress-checkins] sent=${sent} skipped=${skipped} errors=${errors}`);

    return NextResponse.json({ ok: true, sent, skipped, errors });
  } catch (err) {
    console.error("[cron/progress-checkins] fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
