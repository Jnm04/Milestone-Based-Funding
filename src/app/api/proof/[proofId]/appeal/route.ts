import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// ─── Lazy Anthropic client ────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ─── POST /api/proof/[proofId]/appeal ─────────────────────────────────────────
//
// Startup submits a written rebuttal challenging an AI rejection.
// Claude Haiku evaluates the rebuttal and either overturns (→ PENDING_REVIEW)
// or upholds the original decision. One appeal per proof, max.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { proofId } = await params;

  // ── Load proof with contract ──────────────────────────────────────────────
  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: {
      contract: {
        select: { id: true, startupId: true, investorId: true, milestone: true, status: true },
      },
      milestone: { select: { id: true, title: true } },
    },
  });

  if (!proof) {
    return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  }

  // ── Authorization: startup on this contract only ──────────────────────────
  if (proof.contract.startupId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden — only the receiver can file an appeal" },
      { status: 403 }
    );
  }

  // ── Validate state ────────────────────────────────────────────────────────
  if (proof.aiDecision !== "NO") {
    return NextResponse.json({ error: "Can only appeal a rejected proof" }, { status: 400 });
  }
  if (proof.appealStatus !== null) {
    return NextResponse.json(
      { error: "An appeal has already been filed for this proof" },
      { status: 409 }
    );
  }
  if (proof.contract.status !== "REJECTED") {
    return NextResponse.json(
      { error: "Contract is not in a rejected state" },
      { status: 409 }
    );
  }

  // ── Rate limit: 5 appeals per hour per user ───────────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`appeal:${session.user.id ?? ip}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many appeals — please wait before trying again." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { rebuttal?: string };
  try {
    body = (await req.json()) as { rebuttal?: string };
  } catch {
    body = {};
  }

  const rebuttal = (body.rebuttal ?? "").trim().slice(0, 1500);
  if (rebuttal.length < 20) {
    return NextResponse.json(
      { error: "Please provide a substantive appeal (at least 20 characters)." },
      { status: 400 }
    );
  }

  // ── Build context for Claude ──────────────────────────────────────────────
  const milestoneTitle = proof.milestone?.title ?? proof.contract.milestone;
  const objections = proof.aiObjections as Array<{ code: string; description: string }> | null;
  const objectionsText =
    objections && objections.length > 0
      ? objections.map((o) => `- ${o.code}: ${o.description}`).join("\n")
      : "(No specific objections recorded)";

  // ── Evaluate appeal with Claude Haiku ─────────────────────────────────────
  try {
    const anthropic = getAnthropic();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are an impartial appeal arbitrator for a milestone escrow platform.
A startup is challenging an AI rejection of their milestone proof.
Evaluate whether the rebuttal raises a legitimate point that warrants human review.
Respond ONLY with valid JSON (no markdown, no code blocks): {"decision": "OVERTURNED" | "UPHELD", "reasoning": "2-3 sentences"}

Rules:
- OVERTURNED: the rebuttal makes a credible, specific argument that the proof may have been incorrectly rejected — route to human review
- UPHELD: the rebuttal is vague, does not address the specific rejection reasons, or adds no new information
- Be strict: only overturn if the argument is genuinely informative and directly challenges the objections`,
      messages: [
        {
          role: "user",
          content: `Milestone: "${milestoneTitle}"\n\nOriginal AI rejection reasoning:\n"${proof.aiReasoning ?? "Not available"}"\n\nSpecific objections:\n${objectionsText}\n\nStartup's appeal:\n"${rebuttal}"`,
        },
      ],
    });

    // ── Parse response ────────────────────────────────────────────────────
    const rawText =
      aiResponse.content[0]?.type === "text" ? aiResponse.content[0].text.trim() : "";
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let result: { decision: string; reasoning: string };
    try {
      result = JSON.parse(jsonText) as typeof result;
    } catch {
      console.error("[appeal] JSON parse failed. Raw:", rawText);
      return NextResponse.json(
        { error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    if (!["OVERTURNED", "UPHELD"].includes(result.decision)) {
      console.error("[appeal] Invalid decision:", result);
      return NextResponse.json(
        { error: "AI returned an invalid decision. Please try again." },
        { status: 502 }
      );
    }

    // ── Log usage (non-fatal) ─────────────────────────────────────────────
    void prisma.apiUsage
      .create({
        data: {
          model: "Claude Haiku",
          inputTokens: aiResponse.usage.input_tokens,
          outputTokens: aiResponse.usage.output_tokens,
          estimatedCostUsd:
            (0.8 * aiResponse.usage.input_tokens + 4.0 * aiResponse.usage.output_tokens) /
            1_000_000,
          context: "appeal",
        },
      })
      .catch(() => {});

    const now = new Date();
    const appealStatus = result.decision === "OVERTURNED" ? "APPROVED" : "REJECTED";

    // ── Persist appeal result on proof ────────────────────────────────────
    await prisma.proof.update({
      where: { id: proofId },
      data: {
        appealStatus,
        appealText: rebuttal,
        appealResult: result.decision,
        appealReasoning: result.reasoning,
        appealedAt: now,
      },
    });

    // ── If overturned, escalate contract + milestone to PENDING_REVIEW ────
    if (result.decision === "OVERTURNED") {
      if (proof.milestoneId) {
        await prisma.milestone.update({
          where: { id: proof.milestoneId },
          data: { status: "PENDING_REVIEW" as never },
        });
      }
      await prisma.contract.update({
        where: { id: proof.contract.id },
        data: { status: "PENDING_REVIEW" as never },
      });
    }

    return NextResponse.json({
      decision: result.decision as "OVERTURNED" | "UPHELD",
      reasoning: result.reasoning,
      appealStatus,
    });
  } catch (err) {
    console.error("[appeal] AI evaluation failed:", err);
    return NextResponse.json(
      { error: "Failed to evaluate appeal. Please try again." },
      { status: 500 }
    );
  }
}
