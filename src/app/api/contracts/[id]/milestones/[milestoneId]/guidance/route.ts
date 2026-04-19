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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuidanceChecklistItem {
  item: string;
  why: string;
}

export interface GuidanceResponse {
  tone: string;
  checklist: GuidanceChecklistItem[];
  cachedAt: string;
  fromCache: boolean;
}

// ─── GET /api/contracts/[id]/milestones/[milestoneId]/guidance ────────────────
//
// Returns (or generates) AI proof coaching for a specific milestone.
// Only accessible by the startup assigned to this contract.
// Guidance is cached permanently on the Milestone record — generated once, free forever.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  // ── Authorization: only the startup on this contract ──────────────────────
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { startupId: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Load milestone ────────────────────────────────────────────────────────
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId, contractId },
    select: {
      id: true,
      title: true,
      proofGuidance: true,
      proofGuidanceCachedAt: true,
    },
  });

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  // ── Return cached guidance (permanent cache — never regenerated) ──────────
  if (milestone.proofGuidance) {
    const cached = milestone.proofGuidance as unknown as { tone: string; checklist: GuidanceChecklistItem[] };
    return NextResponse.json({
      tone: cached.tone,
      checklist: cached.checklist,
      cachedAt: milestone.proofGuidanceCachedAt?.toISOString() ?? new Date().toISOString(),
      fromCache: true,
    } satisfies GuidanceResponse);
  }

  // ── Rate limit: 20 generations per hour per user ──────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`proof-guidance:${session.user.id ?? ip}`, 20, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests — please wait before generating again." }, { status: 429 });
  }

  // ── Generate with Claude Haiku ────────────────────────────────────────────
  try {
    const anthropic = getAnthropic();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a friendly proof coach for a startup milestone escrow platform.
Help startups submit evidence that passes AI verification.
Be encouraging, specific, and practical. Write like a helpful mentor who wants them to succeed.
Respond ONLY with valid JSON (no markdown, no code blocks): { "tone": "...", "checklist": [{ "item": "...", "why": "..." }] }
Rules:
- 4 to 7 checklist items, specific to this milestone
- Use imperative verbs: "Include...", "Screenshot...", "Link to...", "Attach...", "Show..."
- Each "why" explains what the AI reviewers look for (1 short sentence)
- "tone" is 1 encouraging sentence framing the checklist (max 20 words)`,
      messages: [
        {
          role: "user",
          content: `Generate proof submission guidance for this milestone: "${milestone.title}"`,
        },
      ],
    });

    // ── Parse response ────────────────────────────────────────────────────
    const rawText = aiResponse.content[0]?.type === "text" ? aiResponse.content[0].text.trim() : "";

    // Strip markdown code fences if present (defensive)
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let guidance: { tone: string; checklist: GuidanceChecklistItem[] };
    try {
      guidance = JSON.parse(jsonText) as typeof guidance;
    } catch {
      console.error("[guidance] JSON parse failed. Raw:", rawText);
      return NextResponse.json(
        { error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // Validate structure
    if (
      typeof guidance.tone !== "string" ||
      !Array.isArray(guidance.checklist) ||
      guidance.checklist.length === 0
    ) {
      console.error("[guidance] Invalid AI structure:", guidance);
      return NextResponse.json(
        { error: "AI returned an invalid structure. Please try again." },
        { status: 502 }
      );
    }

    // Sanitize each checklist item
    guidance.checklist = guidance.checklist
      .filter((c) => typeof c.item === "string" && typeof c.why === "string")
      .slice(0, 7);

    const now = new Date();

    // ── Persist permanently (never regenerated after this) ────────────────
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        proofGuidance: guidance as unknown as import("@prisma/client").Prisma.InputJsonValue,
        proofGuidanceCachedAt: now,
      },
    });

    // ── Log API usage (non-fatal) ─────────────────────────────────────────
    void prisma.apiUsage
      .create({
        data: {
          model: "Claude Haiku",
          inputTokens: aiResponse.usage.input_tokens,
          outputTokens: aiResponse.usage.output_tokens,
          estimatedCostUsd:
            (0.8 * aiResponse.usage.input_tokens + 4.0 * aiResponse.usage.output_tokens) /
            1_000_000,
          context: "guidance",
        },
      })
      .catch(() => {});

    return NextResponse.json({
      tone: guidance.tone,
      checklist: guidance.checklist,
      cachedAt: now.toISOString(),
      fromCache: false,
    } satisfies GuidanceResponse);
  } catch (err) {
    console.error("[guidance] AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate guidance. Please try again in a moment." },
      { status: 500 }
    );
  }
}
