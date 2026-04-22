import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export interface WizardResponse {
  title: string;
  goalDescription: string;
  suggestedDataSourceType: "FILE_UPLOAD" | "URL_SCRAPE" | "REST_API";
  suggestedDataSourceHint: string;
  suggestedDeadline: string;
  verificationCriteria: string[];
}

/**
 * POST /api/attestation/wizard
 * Takes a plain-language goal description and returns a structured attestation milestone.
 * Rate limited: 10/hour per user.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`attestation-wizard:${session.user.id ?? ip}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many wizard requests. Please wait before trying again." }, { status: 429 });
  }

  let body: { description?: string };
  try {
    body = (await req.json()) as { description?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const description = body.description?.trim() ?? "";
  if (description.length < 20) {
    return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 });
  }
  if (description.length > 2000) {
    return NextResponse.json({ error: "Description must be at most 2000 characters" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 768,
    system: `You are a KPI structuring assistant for cascrow, an enterprise attestation platform.
A company describes a goal in plain language. You structure it into a formal attestation milestone.

Data source types:
- FILE_UPLOAD: best for annual reports, PDFs, spreadsheets, certificates
- URL_SCRAPE: best for public web pages, sustainability reports online, regulatory registries
- REST_API: best for live business data (Stripe, analytics, HR systems, internal APIs)

Respond ONLY with valid JSON (no markdown):
{
  "title": "concise milestone title (max 80 chars)",
  "goalDescription": "formal description of what must be true for this milestone to be met (1-2 sentences, measurable)",
  "suggestedDataSourceType": "FILE_UPLOAD" | "URL_SCRAPE" | "REST_API",
  "suggestedDataSourceHint": "plain-English explanation of what the company should provide as the data source",
  "suggestedDeadline": "ISO date string (YYYY-MM-DD) — deadline by which the goal should be verified",
  "verificationCriteria": ["criterion 1", "criterion 2", "criterion 3"]
}`,
    messages: [
      {
        role: "user",
        content: `Today is ${today}. Structure this goal into a formal attestation milestone:\n\n${description}`,
      },
    ],
  });

  const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let result: WizardResponse;
  try {
    result = JSON.parse(jsonText) as WizardResponse;
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON — please try again" }, { status: 500 });
  }

  void prisma.apiUsage.create({
    data: {
      model: "Claude Haiku",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      estimatedCostUsd:
        (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
      context: "attestation-wizard",
    },
  }).catch(() => {});

  return NextResponse.json(result);
}
