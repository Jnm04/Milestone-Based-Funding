import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

// ─── Lazy Anthropic client ────────────────────────────────────────────────────
let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export interface RiskFlag {
  severity: "WARNING" | "INFO";
  text: string;
}

export interface RiskPreviewResponse {
  flags: RiskFlag[];
}

// ─── POST /api/contracts/risk-preview ────────────────────────────────────────
//
// Analyses a milestone plan for structural risks before contract creation.
// No DB writes — purely advisory. Returns up to 5 flags.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: 20/hour per user ──────────────────────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(
    `risk-preview:${session.user.id ?? ip}`,
    20,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait before checking again." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { milestones?: Array<{ title: string; amountUSD: number | string; deadlineDays: number | string }> };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const milestones = body.milestones ?? [];
  if (milestones.length === 0) {
    return NextResponse.json({ error: "No milestones provided" }, { status: 400 });
  }

  const milestoneLines = milestones.map((m, i) =>
    `${i + 1}. "${m.title}" — $${Number(m.amountUSD)} RLUSD, deadline in ${Number(m.deadlineDays)} days`
  );

  // ── Generate with Claude Haiku ────────────────────────────────────────────
  try {
    const anthropic = getAnthropic();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: `You are a contract risk analyst for a milestone-based grant escrow platform.
Review the milestone plan and identify structural problems that could cause disputes or failed verifications.
Respond ONLY with valid JSON (no markdown, no code blocks): [{"severity": "WARNING"|"INFO", "text": "string"}]

Rules:
- Return an empty array [] if no issues found
- Maximum 5 flags
- "WARNING": real risk — vague/unverifiable milestone, unrealistic deadline, disproportionate amount, multiple distinct deliverables bundled in one milestone
- "INFO": advisory — suggestion to strengthen the plan, not a blocker
- text: one concise sentence, actionable, references the specific milestone by number
- Do NOT flag things that are fine. Only flag genuine structural issues.`,
      messages: [
        {
          role: "user",
          content: `Review this milestone plan for structural risks:\n\n${milestoneLines.join("\n")}`,
        },
      ],
    });

    const rawText =
      aiResponse.content[0]?.type === "text" ? aiResponse.content[0].text.trim() : "[]";
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let flags: RiskFlag[];
    try {
      flags = JSON.parse(jsonText) as RiskFlag[];
    } catch {
      return NextResponse.json({ flags: [] } satisfies RiskPreviewResponse);
    }

    const validated = flags
      .filter(
        (f) =>
          typeof f.text === "string" &&
          f.text.length > 0 &&
          ["WARNING", "INFO"].includes(f.severity)
      )
      .slice(0, 5);

    // Log usage (non-fatal)
    void prisma.apiUsage
      .create({
        data: {
          model: "Claude Haiku",
          inputTokens: aiResponse.usage.input_tokens,
          outputTokens: aiResponse.usage.output_tokens,
          estimatedCostUsd:
            (0.8 * aiResponse.usage.input_tokens + 4.0 * aiResponse.usage.output_tokens) /
            1_000_000,
          context: "risk-preview",
        },
      })
      .catch(() => {});

    return NextResponse.json({ flags: validated } satisfies RiskPreviewResponse);
  } catch (err) {
    console.error("[risk-preview] Failed:", err);
    return NextResponse.json(
      { error: "Failed to analyse milestones. Please try again." },
      { status: 500 }
    );
  }
}
