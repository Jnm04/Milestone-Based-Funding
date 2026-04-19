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

export interface CredibilitySignal {
  label: string;
  value: string;
  positive: boolean;
}

export interface CredibilityResponse {
  score: number;
  tier: "HIGH" | "MEDIUM" | "LOW";
  signals: CredibilitySignal[];
  summary: string;
  cachedAt: string;
  fromCache: boolean;
}

// ─── 7-day cache TTL ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── GET /api/contracts/[id]/credibility ──────────────────────────────────────
//
// Returns (or generates) an AI credibility score for the startup on this contract.
// Only accessible by the investor on this contract.
// Cached for 7 days in the CredibilityScore table.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId } = await params;

  // ── Authorization: only the investor on this contract ─────────────────────
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      investorId: true,
      startupId: true,
      startup: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          kycTier: true,
          companyName: true,
          bio: true,
          website: true,
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!contract.startup) {
    return NextResponse.json({ error: "No startup on this contract yet" }, { status: 400 });
  }

  const startup = contract.startup;

  // ── Return valid cache (< 7 days) ─────────────────────────────────────────
  const existing = await prisma.credibilityScore.findUnique({
    where: { startupId_contractId: { startupId: startup.id, contractId } },
  });

  if (existing && Date.now() - existing.cachedAt.getTime() < CACHE_TTL_MS) {
    return NextResponse.json({
      score: existing.score,
      tier: existing.tier,
      signals: existing.signals as CredibilitySignal[],
      summary: existing.summary,
      cachedAt: existing.cachedAt.toISOString(),
      fromCache: true,
    } satisfies CredibilityResponse);
  }

  // ── Rate limit: 20 generations per hour per user ──────────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`credibility:${session.user.id ?? ip}`, 20, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests — please wait before recalculating." },
      { status: 429 }
    );
  }

  // ── Gather raw signals ────────────────────────────────────────────────────

  // Past contracts (exclude current)
  const pastContracts = await prisma.contract.findMany({
    where: { startupId: startup.id, id: { not: contractId } },
    select: { status: true },
  });
  const completedContracts = pastContracts.filter((c) => c.status === "COMPLETED").length;
  const failedContracts = pastContracts.filter((c) =>
    ["REJECTED", "EXPIRED", "DECLINED"].includes(c.status)
  ).length;
  const totalPastContracts = pastContracts.length;

  // GitHub data (optional — pulled from website field if it contains github.com)
  let githubData: Record<string, unknown> | null = null;
  const githubMatch = startup.website?.match(/github\.com\/([A-Za-z0-9_-]+)/);
  if (githubMatch) {
    try {
      const ghRes = await fetch(`https://api.github.com/users/${githubMatch[1]}`, {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(5000),
      });
      if (ghRes.ok) {
        const gh = (await ghRes.json()) as {
          created_at: string;
          public_repos: number;
          followers: number;
          updated_at: string;
        };
        const accountAgeDays = Math.floor(
          (Date.now() - new Date(gh.created_at).getTime()) / 86_400_000
        );
        githubData = {
          accountAgeDays,
          publicRepos: gh.public_repos,
          followers: gh.followers,
          lastActiveDaysAgo: Math.floor(
            (Date.now() - new Date(gh.updated_at).getTime()) / 86_400_000
          ),
        };
      }
    } catch {
      // GitHub fetch is best-effort — never fail the request over it
    }
  }

  const rawSignals = {
    emailVerified: startup.emailVerified,
    kycTier: startup.kycTier,
    companyNameFilled: !!startup.companyName,
    bioFilled: !!startup.bio,
    websiteFilled: !!startup.website,
    totalPastContracts,
    completedContracts,
    failedContracts,
    github: githubData,
  };

  // ── Build human-readable signal summary for the prompt ────────────────────
  const signalLines = [
    `Email verified: ${startup.emailVerified ? "Yes" : "No"}`,
    `KYC tier: ${startup.kycTier} (0=email only, 1=sanctions cleared, 2=manual KYC, 3=KYB)`,
    `Company name: ${startup.companyName ? "Provided" : "Not provided"}`,
    `Bio: ${startup.bio ? "Provided" : "Not provided"}`,
    `Website: ${startup.website ? `Provided (${startup.website})` : "Not provided"}`,
    `Past cascrow contracts: ${totalPastContracts} total, ${completedContracts} completed, ${failedContracts} failed`,
  ];

  if (githubData) {
    signalLines.push(
      `GitHub account age: ${githubData.accountAgeDays} days`,
      `GitHub public repos: ${githubData.publicRepos}`,
      `GitHub followers: ${githubData.followers}`,
      `GitHub last active: ${githubData.lastActiveDaysAgo} days ago`
    );
  }

  // ── Generate with Claude Haiku ────────────────────────────────────────────
  try {
    const anthropic = getAnthropic();

    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are a startup credibility analyst for a milestone-based grant escrow platform.
Evaluate the startup based ONLY on the provided signals. Do NOT invent signals.
Respond ONLY with valid JSON (no markdown, no code blocks):
{ "score": 75, "tier": "MEDIUM", "summary": "...", "signals": [{ "label": "...", "value": "...", "positive": true }] }

Rules:
- "score" is an integer 0–100
- "tier": "HIGH" (score ≥80), "MEDIUM" (50–79), "LOW" (<50)
- "signals": 4–8 items — one per meaningful signal provided. label is short (≤4 words), value is factual, positive is true/false
- "summary": 2–3 sentences. Investor-facing. Professional tone. Explain what gives you confidence or concern.
- Scoring guide: 80–100 = low risk, 50–79 = moderate risk, 0–49 = high risk
- Weight: completed contracts > GitHub activity > KYC tier > profile completeness > email verified`,
      messages: [
        {
          role: "user",
          content: `Generate a credibility score for this startup based on these signals:\n\n${signalLines.join("\n")}`,
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

    let result: {
      score: number;
      tier: string;
      summary: string;
      signals: CredibilitySignal[];
    };
    try {
      result = JSON.parse(jsonText) as typeof result;
    } catch {
      console.error("[credibility] JSON parse failed. Raw:", rawText);
      return NextResponse.json(
        { error: "AI returned an unexpected response. Please try again." },
        { status: 502 }
      );
    }

    // Validate structure
    if (
      typeof result.score !== "number" ||
      !["HIGH", "MEDIUM", "LOW"].includes(result.tier) ||
      typeof result.summary !== "string" ||
      !Array.isArray(result.signals) ||
      result.signals.length === 0
    ) {
      console.error("[credibility] Invalid AI structure:", result);
      return NextResponse.json(
        { error: "AI returned an invalid structure. Please try again." },
        { status: 502 }
      );
    }

    // Clamp score
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));

    // Sanitize signals
    result.signals = result.signals
      .filter(
        (s) =>
          typeof s.label === "string" &&
          typeof s.value === "string" &&
          typeof s.positive === "boolean"
      )
      .slice(0, 8);

    const now = new Date();

    // ── Upsert into DB ────────────────────────────────────────────────────
    await prisma.credibilityScore.upsert({
      where: { startupId_contractId: { startupId: startup.id, contractId } },
      create: {
        startupId: startup.id,
        contractId,
        score: result.score,
        tier: result.tier,
        signals: result.signals as unknown as import("@prisma/client").Prisma.InputJsonValue,
        summary: result.summary,
        rawSignals: rawSignals as unknown as import("@prisma/client").Prisma.InputJsonValue,
        cachedAt: now,
      },
      update: {
        score: result.score,
        tier: result.tier,
        signals: result.signals as unknown as import("@prisma/client").Prisma.InputJsonValue,
        summary: result.summary,
        rawSignals: rawSignals as unknown as import("@prisma/client").Prisma.InputJsonValue,
        cachedAt: now,
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
          context: "credibility",
        },
      })
      .catch(() => {});

    return NextResponse.json({
      score: result.score,
      tier: result.tier as "HIGH" | "MEDIUM" | "LOW",
      signals: result.signals,
      summary: result.summary,
      cachedAt: now.toISOString(),
      fromCache: false,
    } satisfies CredibilityResponse);
  } catch (err) {
    console.error("[credibility] AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate credibility score. Please try again in a moment." },
      { status: 500 }
    );
  }
}
