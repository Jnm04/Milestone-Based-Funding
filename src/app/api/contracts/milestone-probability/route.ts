import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/contracts/milestone-probability
 * Given a milestone title, deadline (days), and optional amount, returns an AI-estimated
 * completion probability. Advisory only — no DB writes to Contract or Milestone.
 *
 * Body: { title: string, deadlineDays: number, amountUSD?: number }
 */

export interface ProbabilityResponse {
  probability: number;
  tier: "REALISTIC" | "AMBITIOUS" | "HIGH_RISK";
  reasoning: string;
  suggestion: string | null;
}

const HAIKU_INPUT_PER_M = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    if (!(await checkRateLimit(`milestone-probability:${session.user.id}`, 30, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { title, deadlineDays, amountUSD } = body as {
      title?: string;
      deadlineDays?: number;
      amountUSD?: number;
    };

    if (!title || typeof title !== "string" || title.trim().length < 5) {
      return NextResponse.json({ error: "title must be at least 5 characters" }, { status: 400 });
    }
    if (typeof deadlineDays !== "number" || deadlineDays < 1) {
      return NextResponse.json({ error: "deadlineDays must be a positive number" }, { status: 400 });
    }

    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: `You are a milestone feasibility analyst for a grant escrow platform.
Given a milestone description and deadline, estimate the probability of successful completion.
Base your estimate on the complexity implied by the description and the realism of the timeline.
Respond ONLY with valid JSON: { "probability": 55, "tier": "REALISTIC|AMBITIOUS|HIGH_RISK", "reasoning": "1 sentence", "suggestion": "1 sentence or null" }
probability is an integer 0-100. Be calibrated — most well-structured milestones with realistic deadlines should score 70-85.
Tiers: REALISTIC ≥75, AMBITIOUS 50-74, HIGH_RISK <50.
suggestion: null if REALISTIC, otherwise a short concrete suggestion (e.g. "Consider 45 days for a more realistic timeline.").`,
      messages: [
        {
          role: "user",
          content: `Milestone: "${title.slice(0, 500)}"
Deadline: ${deadlineDays} days${amountUSD ? `\nAmount: $${amountUSD} USD` : ""}`,
        },
      ],
    });

    // Track API usage (non-blocking)
    const inputTokens = msg.usage?.input_tokens ?? 0;
    const outputTokens = msg.usage?.output_tokens ?? 0;
    prisma.apiUsage.create({
      data: {
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          (inputTokens / 1_000_000) * HAIKU_INPUT_PER_M +
          (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M,
        context: "milestone-probability",
      },
    }).catch(() => {});

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let result: ProbabilityResponse;
    try {
      const parsed = JSON.parse(cleaned) as {
        probability?: unknown;
        tier?: unknown;
        reasoning?: unknown;
        suggestion?: unknown;
      };
      const prob =
        typeof parsed.probability === "number"
          ? Math.min(100, Math.max(0, Math.round(parsed.probability)))
          : 70;
      const tierRaw = typeof parsed.tier === "string" ? parsed.tier : "";
      const tier: ProbabilityResponse["tier"] =
        tierRaw === "REALISTIC"
          ? "REALISTIC"
          : tierRaw === "HIGH_RISK"
          ? "HIGH_RISK"
          : "AMBITIOUS";
      result = {
        probability: prob,
        tier,
        reasoning:
          typeof parsed.reasoning === "string" && parsed.reasoning.length > 0
            ? parsed.reasoning
            : "No reasoning provided.",
        suggestion:
          typeof parsed.suggestion === "string" && parsed.suggestion.length > 0
            ? parsed.suggestion
            : null,
      };
    } catch {
      result = {
        probability: 70,
        tier: "AMBITIOUS",
        reasoning: "Could not assess this milestone.",
        suggestion: null,
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[milestone-probability] Error:", err);
    return NextResponse.json({ error: "Failed to assess milestone" }, { status: 500 });
  }
}
