import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAttestation } from "@/services/attestation/runner.service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

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

  // Rate limit: by IP (prevents IP-based abuse) AND by email-hash per contract
  // (prevents a single auditor from spamming across IP rotations)
  const ip = getClientIp(req);
  const emailHash = crypto.createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 16);
  const [ipOk, emailOk] = await Promise.all([
    checkRateLimit(`auditor-run:ip:${milestoneId}:${ip}`, 2, 60 * 60 * 1000),
    checkRateLimit(`auditor-run:email:${contractId}:${emailHash}`, 5, 60 * 60 * 1000),
  ]);
  if (!ipOk || !emailOk) {
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
    return NextResponse.json({
      success: true,
      verdict: result.verdict,
      reasoning: result.reasoning,
      certUrl: result.certUrl ?? null,
      xrplTxHash: result.xrplTxHash ?? null,
      period,
    });
  } catch (err) {
    console.error("[auditor-run]", err);
    return NextResponse.json({ error: "Attestation re-run failed" }, { status: 500 });
  }
}
