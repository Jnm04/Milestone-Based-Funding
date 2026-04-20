/**
 * POST /api/contracts/[id]/milestones/[milestoneId]/renegotiate
 *
 * Startup submits an interim progress update and requests a deadline extension.
 * Called when the milestone is in RENEGOTIATING status.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { assessInterimUpdate } from "@/services/ai/renegotiation.service";
import { sendExtensionRequestedEmail } from "@/lib/email";

const VALID_EXTENSION_DAYS = [7, 14, 30] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  // ── Load milestone with contract + investor ───────────────────────────────
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

  // ── Auth: only the startup on this contract ───────────────────────────────
  if (milestone.contract.startupId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden — only the Receiver can submit a renegotiation request" },
      { status: 403 }
    );
  }

  // Rate limit: 5 renegotiation requests per user per hour (AI call + investor email)
  if (!(await checkRateLimit(`renegotiate:${session.user.id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many renegotiation requests. Please wait before submitting again." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // ── State validation ──────────────────────────────────────────────────────
  if (milestone.status !== ("RENEGOTIATING" as never)) {
    return NextResponse.json(
      { error: "Milestone is not in renegotiation window" },
      { status: 409 }
    );
  }

  if (milestone.renegotiationDeadline && new Date() > milestone.renegotiationDeadline) {
    return NextResponse.json(
      { error: "The renegotiation window has closed" },
      { status: 409 }
    );
  }

  if (
    milestone.renegotiationStatus === "EXTENSION_REQUESTED" ||
    milestone.renegotiationStatus === "EXTENSION_APPROVED" ||
    milestone.renegotiationStatus === "EXTENSION_REJECTED"
  ) {
    return NextResponse.json(
      { error: "An extension request has already been submitted for this milestone" },
      { status: 409 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { interimUpdateText?: string; extensionDays?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const interimUpdateText = (body.interimUpdateText ?? "").trim().slice(0, 3000);
  if (interimUpdateText.length < 100) {
    return NextResponse.json(
      { error: "Progress update must be at least 100 characters" },
      { status: 400 }
    );
  }

  const extensionDays = body.extensionDays;
  if (!extensionDays || !(VALID_EXTENSION_DAYS as readonly number[]).includes(extensionDays)) {
    return NextResponse.json(
      { error: "extensionDays must be 7, 14, or 30" },
      { status: 400 }
    );
  }

  // ── Run AI assessment ─────────────────────────────────────────────────────
  let assessment: { plausible: boolean; assessment: string; concerns: string[] };
  try {
    assessment = await assessInterimUpdate({
      milestoneTitle: milestone.title,
      interimUpdateText,
      extensionDays,
    });
  } catch (err) {
    console.error("[renegotiate] AI assessment failed:", err);
    // Fallback — don't block the flow if AI is unavailable
    assessment = {
      plausible: true,
      assessment: "AI assessment unavailable. The Grant Giver will decide based on the update.",
      concerns: [],
    };
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      renegotiationStatus: "EXTENSION_REQUESTED",
      interimUpdateText,
      interimAiAssessment: assessment.assessment,
      interimAiPositive: assessment.plausible,
      extensionDays,
    },
  });

  // ── Notify investor (fire-and-forget) ────────────────────────────────────
  const { investor, startup } = milestone.contract;
  sendExtensionRequestedEmail({
    to: investor.email,
    contractId,
    milestoneTitle: milestone.title,
    extensionDays,
    startupName: startup?.name ?? startup?.companyName ?? null,
  }).catch((err) => console.error("[email] sendExtensionRequestedEmail failed:", err));

  return NextResponse.json({
    ok: true,
    assessment: assessment.assessment,
    plausible: assessment.plausible,
    concerns: assessment.concerns,
  });
}
