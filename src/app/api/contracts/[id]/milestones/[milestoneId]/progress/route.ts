/**
 * POST /api/contracts/[id]/milestones/[milestoneId]/progress
 *
 * Startup logs a voluntary progress update while a milestone is FUNDED.
 * Creates a ProgressUpdate record and notifies the investor via email.
 * No status change — purely informational.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendProgressUpdateNotifiedEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  // ── Load milestone with contract + parties ────────────────────────────────
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: {
        include: { investor: true, startup: true },
      },
    },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  // ── Auth: only the startup ────────────────────────────────────────────────
  if (milestone.contract.startupId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden — only the Receiver can log progress updates" },
      { status: 403 }
    );
  }

  // Rate limit: 10 updates per user per hour to prevent email spam to investor
  if (!(await checkRateLimit(`progress-update:${session.user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many progress updates. Please wait before submitting again." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // ── State validation: must be FUNDED or PROOF_SUBMITTED ──────────────────
  if (!["FUNDED", "PROOF_SUBMITTED"].includes(milestone.status)) {
    return NextResponse.json(
      { error: "Progress updates can only be logged while the milestone is funded" },
      { status: 409 }
    );
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: { text?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 20) {
    return NextResponse.json(
      { error: "Progress update must be at least 20 characters" },
      { status: 400 }
    );
  }
  if (text.length > 1000) {
    return NextResponse.json(
      { error: "Progress update must be at most 1000 characters" },
      { status: 400 }
    );
  }

  // ── Create the update ─────────────────────────────────────────────────────
  const update = await prisma.progressUpdate.create({
    data: {
      milestoneId,
      text,
      source: "MANUAL",
    },
  });

  // ── Notify investor (fire-and-forget) ─────────────────────────────────────
  const { investor, startup } = milestone.contract;
  sendProgressUpdateNotifiedEmail({
    to: investor.email,
    contractId,
    milestoneTitle: milestone.title,
    updateText: text,
    startupName: startup?.name ?? startup?.companyName ?? null,
  }).catch((err) => console.error("[email] sendProgressUpdateNotifiedEmail failed:", err));

  return NextResponse.json({ ok: true, update: { id: update.id, text: update.text, createdAt: update.createdAt.toISOString() } });
}
