import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAttestation } from "@/services/attestation/runner.service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function currentPeriod(scheduleType: string | null): string {
  const now = new Date();
  if (scheduleType === "MONTHLY") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (scheduleType === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  if (scheduleType === "ANNUAL") return String(now.getFullYear());
  return now.toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params;

  let body: { milestoneId?: string; email?: string };
  try {
    body = (await req.json()) as { milestoneId?: string; email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { milestoneId, email } = body;
  if (!milestoneId || !email) {
    return NextResponse.json({ error: "milestoneId and email are required" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { mode: true, auditorEmail: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation goal set" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedAuditorEmail = contract.auditorEmail?.trim().toLowerCase();

  if (!normalizedAuditorEmail || normalizedEmail !== normalizedAuditorEmail) {
    return NextResponse.json(
      { error: "Your email does not match the registered auditor email for this goal set." },
      { status: 403 }
    );
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId, contractId },
    select: { id: true, scheduleType: true, dataSourceLockedAt: true, dataSourceType: true },
  });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  if (!milestone.dataSourceLockedAt) {
    return NextResponse.json({ error: "Data source has not been locked yet." }, { status: 409 });
  }
  if (milestone.dataSourceType === "MANUAL_REVIEW") {
    return NextResponse.json({ error: "Manual review milestones cannot be re-run automatically." }, { status: 409 });
  }

  // Rate limit: 2 auditor re-runs per milestone per hour (by IP)
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`auditor-run:${milestoneId}:${ip}`, 2, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many re-run requests. Please wait before trying again." },
      { status: 429 }
    );
  }

  try {
    const period = currentPeriod(milestone.scheduleType);
    const result = await runAttestation(milestoneId, period, "MANUAL", {
      type: "AUDITOR_RERUN",
      auditorEmail: email.trim(),
      skipMilestoneUpdate: true,
      skipAuditorNotify: true,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Attestation re-run failed";
    console.error("[auditor-run]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
