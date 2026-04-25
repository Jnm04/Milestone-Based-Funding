import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
let _anthropic: Anthropic | null = null;
const getAnthropic = () => (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export interface TopicDetail {
  disclosureRequirements: { code: string; title: string; what: string }[];
  dataNeeds: string[];
  typicalGaps: string[];
  reportingTip: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(`materiality-topic-detail:${session.user.id}`, 30, 3600);
  if (!rl) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { topic, esrsArticles, griStandards, sector } = body as {
    topic?: string;
    esrsArticles?: string[];
    griStandards?: string[];
    sector?: string;
  };

  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "topic required" }, { status: 400 });
  }

  const systemPrompt = `You are a CSRD/ESG reporting expert. Given a material ESG topic and its ESRS article references, produce a concise actionable guide for a sustainability manager at a mid-sized European company.

Respond ONLY with valid JSON matching this exact shape:
{
  "disclosureRequirements": [
    { "code": "E1-3", "title": "Short title", "what": "1-2 sentences on exactly what must be reported" }
  ],
  "dataNeeds": ["string — concrete data point or KPI needed"],
  "typicalGaps": ["string — common problem companies face when reporting this"],
  "reportingTip": "1-2 sentence practical tip for getting started quickly"
}

Keep it concrete and actionable. Max 4 disclosure requirements, 5 data needs, 3 typical gaps.`;

  const userPrompt = `Sector: ${sector ?? "General"}
Material topic: ${topic}
ESRS articles: ${(esrsArticles ?? []).join(", ") || "none specified"}
GRI standards: ${(griStandards ?? []).join(", ") || "none specified"}

Generate the actionable reporting guide.`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd: (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "materiality-topic-detail",
      },
    }).catch(() => {});

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    const detail = JSON.parse(
      rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
    ) as TopicDetail;

    return NextResponse.json(detail);
  } catch (err) {
    console.error("[topic-detail] AI failed:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
