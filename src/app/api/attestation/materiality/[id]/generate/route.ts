import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
let _anthropic: Anthropic | null = null;
const getAnthropic = () => (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

interface MatrixItem {
  topic: string;
  financialScore: number;
  impactScore: number;
  material: boolean;
  esrsArticles: string[];
  griStandards: string[];
  rationale: string;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlAllowed = await checkRateLimit(`materiality-generate:${session.user.id}`, 3, 3600);
  if (!rlAllowed) return NextResponse.json({ error: "Rate limit exceeded — 3/hour" }, { status: 429 });

  const { id } = await params;
  const assessment = await prisma.materialityAssessment.findUnique({ where: { id } });
  if (!assessment || assessment.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const answers = assessment.answers as { question: string; answer: string }[];
  if (answers.length < 8) {
    return NextResponse.json({ error: "Please complete at least 8 wizard questions first." }, { status: 400 });
  }

  const answersText = answers.map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`).join("\n\n");

  const systemPrompt = `You are a CSRD double-materiality expert for cascrow. Analyze the company profile and produce a materiality matrix.

For each of 15-20 ESG topics, output a JSON array item:
{ "topic": "string", "financialScore": 0-5, "impactScore": 0-5, "material": bool, "esrsArticles": ["ESRS E1-4"], "griStandards": ["GRI 305-1"], "rationale": "1 sentence" }

material = true if financialScore >= 3 OR impactScore >= 3 (CSRD "or" threshold).
Also include a "summary" field (2 paragraphs, executive overview of the materiality profile).

Respond ONLY with valid JSON:
{ "matrix": [...], "summary": "..." }`;

  const userPrompt = `Company sector: ${assessment.sector}

Questionnaire responses:
${answersText}

Generate the materiality matrix and executive summary.`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd: (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "materiality-assessment",
      },
    }).catch(() => {});

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    const parsed = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()) as {
      matrix?: MatrixItem[];
      summary?: string;
    };

    const matrix = Array.isArray(parsed.matrix) ? parsed.matrix : [];
    const summary = parsed.summary ?? "";

    const updated = await prisma.materialityAssessment.update({
      where: { id },
      data: {
        matrix: matrix as unknown as Prisma.InputJsonValue,
        summary,
        status: "COMPLETE",
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[materiality/generate] AI failed:", err);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
