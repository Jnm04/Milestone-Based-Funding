import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isValidCronSecret } from "@/lib/cron-auth";

/**
 * GET /api/cron/calibrate-models
 * Vercel Cron — runs weekly (Sunday midnight).
 *
 * Computes per-model accuracy from the last 90 days of Proof records.
 * Accuracy = fraction of votes where model.decision === proof.aiDecision.
 * Writes calibrated weights to the ModelWeight table.
 *
 * Weight formula: clamp(accuracy / 0.5, 0.5, 2.0)
 *   - 50% accuracy (random chance) → weight 1.0 (neutral)
 *   - 100% accuracy                → weight 2.0 (trusted)
 *   - 0% accuracy                  → weight 0.5 (penalised)
 *
 * IMPORTANT: weights only affect the confidence calculation in verifyMilestone.
 * The 3/5 majority vote threshold is NOT changed.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Fetch all proofs with model votes from the last 90 days that have a final AI decision
    const proofs = await prisma.proof.findMany({
      where: {
        createdAt: { gte: since },
        aiDecision: { not: null },
        aiModelVotes: { not: Prisma.JsonNull },
      },
      select: {
        aiDecision: true,
        aiModelVotes: true,
      },
    });

    type ModelVoteRaw = { model: string; decision: string; confidence?: number };

    // Aggregate per-model vote counts
    const stats: Record<string, { total: number; correct: number }> = {};

    for (const proof of proofs) {
      if (!proof.aiDecision || !Array.isArray(proof.aiModelVotes)) continue;

      const votes = proof.aiModelVotes as ModelVoteRaw[];
      for (const vote of votes) {
        if (!vote.model || !vote.decision) continue;
        const model = vote.model;
        if (!stats[model]) stats[model] = { total: 0, correct: 0 };
        stats[model].total++;
        if (vote.decision === proof.aiDecision) stats[model].correct++;
      }
    }

    const modelNames = Object.keys(stats);
    if (modelNames.length === 0) {
      return NextResponse.json({ ok: true, message: "No proof data in last 90 days — no weights updated" });
    }

    // Upsert ModelWeight for each model with enough data (min 10 votes for reliability)
    const MIN_VOTES = 10;
    let updated = 0;
    let skipped = 0;

    for (const modelName of modelNames) {
      const { total, correct } = stats[modelName];

      if (total < MIN_VOTES) {
        skipped++;
        continue;
      }

      const accuracy = correct / total;
      // weight = accuracy / 0.5 → neutral at 50% accuracy
      const weight = Math.max(0.5, Math.min(2.0, accuracy / 0.5));

      await prisma.modelWeight.upsert({
        where: { modelName },
        create: { modelName, weight, accuracy, totalVotes: total, correctVotes: correct },
        update: { weight, accuracy, totalVotes: total, correctVotes: correct },
      });

      updated++;
    }

    console.log(`[cron/calibrate-models] Updated ${updated} model weights, skipped ${skipped} (insufficient data). Proofs analysed: ${proofs.length}`);

    return NextResponse.json({
      ok: true,
      proofsAnalysed: proofs.length,
      modelsUpdated: updated,
      modelsSkipped: skipped,
      weights: Object.fromEntries(
        modelNames
          .filter((m) => stats[m].total >= MIN_VOTES)
          .map((m) => {
            const { total, correct } = stats[m];
            const accuracy = correct / total;
            return [m, { accuracy: Math.round(accuracy * 1000) / 10, weight: Math.max(0.5, Math.min(2.0, accuracy / 0.5)) }];
          })
      ),
    });
  } catch (err) {
    console.error("[cron/calibrate-models]", err);
    return NextResponse.json({ error: "Calibration failed" }, { status: 500 });
  }
}
