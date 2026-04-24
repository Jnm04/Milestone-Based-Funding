import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/deal-room/[id]/generate-brief
 * Investor triggers AI due-diligence brief generation from uploaded documents.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.dealRoom.findUnique({ where: { id }, include: { documents: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.investorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (room.documents.length === 0) return NextResponse.json({ error: "No documents uploaded yet" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const anthropic = new Anthropic({ apiKey });

  // Build context from document names and URLs
  const docList = room.documents
    .map((d, i) => `Document ${i + 1}: ${d.name} (hash: ${d.sha256.slice(0, 12)}…)`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: `You are a professional venture capital analyst. Analyse the given startup due diligence documents and produce a structured brief.
Respond with ONLY valid JSON matching this schema:
{
  "companyOverview": "2-3 sentence description of what the company does",
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "financialsSummary": "2-3 sentences on financial health, runway, revenue",
  "milestoneFeasibility": "2-3 sentences on whether proposed milestones are realistic",
  "overallRating": "HIGH|MEDIUM|LOW",
  "ratingRationale": "1 sentence explaining the rating"
}`,
    messages: [{
      role: "user",
      content: `The following documents have been uploaded for due diligence:\n\n${docList}\n\nPlease produce a due diligence brief based on the document names and any context you can infer.`,
    }],
  });

  void prisma.apiUsage.create({
    data: {
      model: "Claude Haiku",
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      estimatedCostUsd: (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
      context: "deal-room-brief",
    },
  }).catch(() => {});

  const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";

  const updated = await prisma.dealRoom.update({
    where: { id },
    data: { aiBrief: text, briefAt: new Date() },
  });

  let briefParsed: Record<string, unknown> = {};
  try { briefParsed = JSON.parse(text); } catch { briefParsed = { raw: text }; }

  return NextResponse.json({ brief: briefParsed, briefAt: updated.briefAt });
}
