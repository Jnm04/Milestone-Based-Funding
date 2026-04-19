/**
 * POST /api/proof/precheck
 * Feature I — AI Proof Pre-Check
 *
 * Runs a single-model (Claude Haiku) soft advisory check on the latest proof
 * for a given milestone. Returns plain-language feedback before the startup
 * triggers the real 5-model vote.
 *
 * No status change, no AuditLog entry, no official Proof record created.
 * Rate limited to 5/hour per user to prevent using it as a free unlimited verifier.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { extractPdfText, extractOfficeText, categorizeFile } from "@/services/ai/verifier.service";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const PRECHECK_SYSTEM_PROMPT = `You are an advisory proof reviewer for a milestone escrow platform.
Your role is to give a startup early feedback on whether their proof is likely to pass the official AI verification.
This is NOT the official verification — your feedback is advisory only and will not affect the outcome.

Respond ONLY with valid JSON (no markdown, no explanation outside the JSON):
{
  "verdict": "LIKELY_PASS" | "LIKELY_FAIL" | "BORDERLINE",
  "feedback": "Plain-language assessment of the proof (2-3 sentences)",
  "suggestions": ["specific actionable suggestion", "another suggestion"]
}

LIKELY_PASS: The proof clearly and specifically demonstrates that the milestone was completed. Suggestions are minor polish.
BORDERLINE: The proof partially demonstrates the milestone but has notable gaps that could swing the official vote either way.
LIKELY_FAIL: The proof does not sufficiently demonstrate milestone completion. Specific improvements are needed.

Max 3 suggestions. Each suggestion must be specific and actionable — not generic advice.`;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 5 pre-checks per user per hour
  const allowed = await checkRateLimit(`proof-precheck:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many pre-check requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: { milestoneId?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { milestoneId } = body;
  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
  }

  // Fetch milestone + contract to verify auth and get milestone title
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: { select: { id: true, startupId: true } },
      proofs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, fileUrl: true, fileName: true, extractedText: true },
      },
    },
  });

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  if (milestone.contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["PROOF_SUBMITTED", "FUNDED"].includes(milestone.status)) {
    return NextResponse.json(
      { error: "Pre-check is only available for milestones with an uploaded proof." },
      { status: 409 }
    );
  }

  const latestProof = milestone.proofs[0];
  if (!latestProof) {
    return NextResponse.json({ error: "No proof found for this milestone." }, { status: 404 });
  }

  // Get extracted text — use stored value if available, otherwise try to fetch + extract
  let extractedText = latestProof.extractedText ?? "";

  if (!extractedText && latestProof.fileUrl) {
    try {
      const fileRes = await fetch(latestProof.fileUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (fileRes.ok) {
        const buffer = Buffer.from(await fileRes.arrayBuffer());
        const category = categorizeFile("", latestProof.fileName);
        if (category === "pdf") {
          extractedText = await extractPdfText(buffer);
        } else if (category === "office") {
          extractedText = await extractOfficeText(buffer, latestProof.fileName);
        } else if (category === "text") {
          extractedText = buffer.toString("utf-8").slice(0, 50000);
        }
      }
    } catch (err) {
      console.warn("[precheck] File fetch/extraction failed:", err instanceof Error ? err.message : err);
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI pre-check is not available in this environment." }, { status: 503 });
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userMessage =
      `Milestone to verify:\n${milestone.title}` +
      (extractedText
        ? `\n\nProof document content:\n${extractedText.slice(0, 30_000)}`
        : `\n\nNote: No text could be extracted from this proof (it may be an image or unsupported format). Base your assessment on any available filename context: "${latestProof.fileName}"`);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: PRECHECK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Log usage (fire-and-forget)
    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd: (0.80 * response.usage.input_tokens + 4.00 * response.usage.output_tokens) / 1_000_000,
        context: "proof-precheck",
      },
    }).catch(() => { /* non-fatal */ });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: { verdict?: string; feedback?: string; suggestions?: unknown[] };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      return NextResponse.json({ error: "AI returned an unexpected response. Please try again." }, { status: 502 });
    }

    const verdict = parsed.verdict;
    if (!["LIKELY_PASS", "LIKELY_FAIL", "BORDERLINE"].includes(verdict ?? "")) {
      return NextResponse.json({ error: "AI returned an unexpected verdict. Please try again." }, { status: 502 });
    }

    return NextResponse.json({
      verdict: verdict as "LIKELY_PASS" | "LIKELY_FAIL" | "BORDERLINE",
      feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === "string").slice(0, 3)
        : [],
    });
  } catch (err) {
    console.error("[precheck] AI call failed:", err);
    return NextResponse.json({ error: "AI pre-check failed. Please try again." }, { status: 500 });
  }
}
