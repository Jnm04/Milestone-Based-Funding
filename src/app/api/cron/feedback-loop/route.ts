/**
 * GET /api/cron/feedback-loop
 * Vercel Cron Job — runs weekly Monday 04:00 UTC.
 *
 * Analyses which AI models were overturned by successful appeals.
 * Updates ModelFeedbackWeight records so the verification system
 * can weight model votes more accurately over time.
 *
 * Logic:
 * - Find proofs where appealResult = "OVERTURNED" (investor overturned AI rejection)
 * - For each, look at aiModelVotes to find which models voted incorrectly
 * - Increment falsePositives/falseNegatives per model
 * - Recalculate weightMultiplier: 1 - (errorRate * 0.3), clamped to [0.5, 1.3]
 *   Models with consistent errors get down-weighted; reliable models get up-weighted.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";

const MODEL_KEYS = [
  "claude-haiku",
  "gpt-4o-mini",
  "gemini-flash",
  "mistral-small",
  "cerebras",
] as const;

type ModelKey = (typeof MODEL_KEYS)[number];

function normalizeModelKey(model: string): ModelKey | null {
  const lower = model.toLowerCase();
  if (lower.includes("claude") || lower.includes("haiku")) return "claude-haiku";
  if (lower.includes("gpt") || lower.includes("4o")) return "gpt-4o-mini";
  if (lower.includes("gemini")) return "gemini-flash";
  if (lower.includes("mistral")) return "mistral-small";
  if (lower.includes("cerebras") || lower.includes("qwen")) return "cerebras";
  return null;
}

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure all model weight rows exist
  await Promise.all(
    MODEL_KEYS.map((key) =>
      prisma.modelFeedbackWeight.upsert({
        where: { modelKey: key },
        create: { modelKey: key },
        update: {},
      })
    )
  );

  // Find newly overturned proofs (appeals that flipped AI rejection)
  const overturnedProofs = await prisma.proof.findMany({
    where: {
      appealResult: "OVERTURNED",
      NOT: { aiModelVotes: undefined },
    },
    select: { id: true, aiDecision: true, aiModelVotes: true },
  });

  // Tally errors per model
  const falsePositives: Record<ModelKey, number> = {
    "claude-haiku": 0, "gpt-4o-mini": 0, "gemini-flash": 0, "mistral-small": 0, cerebras: 0,
  };
  const falseNegatives: Record<ModelKey, number> = {
    "claude-haiku": 0, "gpt-4o-mini": 0, "gemini-flash": 0, "mistral-small": 0, cerebras: 0,
  };

  for (const proof of overturnedProofs) {
    type ModelVote = { model: string; decision: string };
    const votes = Array.isArray(proof.aiModelVotes) ? (proof.aiModelVotes as ModelVote[]) : [];
    for (const vote of votes) {
      const key = normalizeModelKey(vote.model);
      if (!key) continue;
      if (proof.aiDecision === "NO" && vote.decision === "NO") {
        falseNegatives[key]++;
      } else if (proof.aiDecision === "YES" && vote.decision === "YES") {
        falsePositives[key]++;
      }
    }
  }

  // Count total votes per model from recent proofs (last 90 days)
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentProofs = await prisma.proof.findMany({
    where: { aiDecision: { not: null }, createdAt: { gte: since90d } },
    select: { aiModelVotes: true },
  });

  const totalVotes: Record<ModelKey, number> = {
    "claude-haiku": 0, "gpt-4o-mini": 0, "gemini-flash": 0, "mistral-small": 0, cerebras: 0,
  };
  for (const proof of recentProofs) {
    type ModelVote = { model: string };
    const votes = Array.isArray(proof.aiModelVotes) ? (proof.aiModelVotes as ModelVote[]) : [];
    for (const vote of votes) {
      const key = normalizeModelKey(vote.model);
      if (key) totalVotes[key]++;
    }
  }

  // Update weights
  const updates = await Promise.all(
    MODEL_KEYS.map(async (key) => {
      const total = totalVotes[key] || 1;
      const errors = falsePositives[key] + falseNegatives[key];
      const errorRate = errors / total;
      // Weight: neutral at 1.0, down-weight errant models, up-weight reliable ones
      const weight = Math.max(0.5, Math.min(1.3, 1.0 - errorRate * 0.5 + (1 - errorRate) * 0.05));

      await prisma.modelFeedbackWeight.update({
        where: { modelKey: key },
        data: {
          falsePositives: { increment: falsePositives[key] },
          falseNegatives: { increment: falseNegatives[key] },
          totalVotes: { increment: totalVotes[key] },
          weightMultiplier: weight,
          lastCalculatedAt: new Date(),
        },
      });

      return { model: key, errorRate: Math.round(errorRate * 100) / 100, weight: Math.round(weight * 100) / 100 };
    })
  );

  return NextResponse.json({
    ok: true,
    overturnedProofsAnalyzed: overturnedProofs.length,
    recentProofsScanned: recentProofs.length,
    modelWeights: updates,
  });
}
