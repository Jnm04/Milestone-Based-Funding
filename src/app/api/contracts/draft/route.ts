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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DraftMilestone {
  title: string;
  amountUSD: number;
  deadlineDays: number;
}

export interface DraftResponse {
  projectTitle: string;
  milestones: DraftMilestone[];
}

// ─── POST /api/contracts/draft ────────────────────────────────────────────────
//
// Investor submits a plain-text project description.
// Claude Haiku returns a structured milestone plan (no DB writes).

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit: 10 drafts per hour per user ───────────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(
    `contract-draft:${session.user.id ?? ip}`,
    10,
    60 * 60 * 1000
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many drafts — please wait before generating again." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { description?: string };
  try {
    body = (await req.json()) as { description?: string };
  } catch {
    body = {};
  }

  const description = (body.description ?? "").trim().slice(0, 2000);
  if (description.length < 20) {
    return NextResponse.json(
      { error: "Please describe your project in at least 20 characters." },
      { status: 400 }
    );
  }

  // ── Generate with Claude Haiku ────────────────────────────────────────────
  try {
    const anthropic = getAnthropic();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a startup milestone planning assistant for a grant escrow platform.
The investor describes their project in plain English. You produce a concrete, verifiable milestone plan.
Respond ONLY with valid JSON (no markdown, no code blocks):
{ "projectTitle": "string", "milestones": [{ "title": "string", "amountUSD": number, "deadlineDays": number }] }

Rules:
- 2–5 milestones, in chronological order
- Each milestone must describe a specific, verifiable deliverable — not vague intentions
- amountUSD: integer, min 100, max 200000. Distribute proportionally to effort.
- deadlineDays: integer, 14–180. Scale to the complexity of each milestone.
- projectTitle: concise (≤8 words), describes the overall project
- Milestone title: 1–2 sentences (max 300 characters) describing exactly what must be delivered and how it will be verified
- Never use phrases like "make progress on" or "work towards" — deliverables must be binary (done or not done)`,
      messages: [
        {
          role: "user",
          content: `Generate a milestone plan for this project:\n\n"${description}"`,
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

    let result: DraftResponse;
    try {
      result = JSON.parse(jsonText) as DraftResponse;
    } catch {
      console.error("[draft] JSON parse failed. Raw:", rawText);
      return NextResponse.json(
        { error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // Validate structure
    if (
      typeof result.projectTitle !== "string" ||
      !Array.isArray(result.milestones) ||
      result.milestones.length === 0 ||
      result.milestones.some(
        (m) =>
          typeof m.title !== "string" ||
          typeof m.amountUSD !== "number" ||
          typeof m.deadlineDays !== "number"
      )
    ) {
      console.error("[draft] Invalid AI structure:", result);
      return NextResponse.json(
        { error: "AI returned an invalid structure. Please try again." },
        { status: 502 }
      );
    }

    // Clamp values to safe ranges
    result.milestones = result.milestones.slice(0, 5).map((m) => ({
      title: m.title.slice(0, 500),
      amountUSD: Math.max(100, Math.min(200000, Math.round(m.amountUSD))),
      deadlineDays: Math.max(14, Math.min(180, Math.round(m.deadlineDays))),
    }));
    result.projectTitle = result.projectTitle.slice(0, 100);

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
          context: "drafting",
        },
      })
      .catch(() => {});

    return NextResponse.json(result satisfies DraftResponse);
  } catch (err) {
    console.error("[draft] AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate milestone plan. Please try again in a moment." },
      { status: 500 }
    );
  }
}
