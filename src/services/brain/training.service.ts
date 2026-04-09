import { prisma } from "@/lib/prisma";
import { generateEmbedding, storeProofEmbedding } from "./embedding.service";

export interface ModelVote {
  model: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
}

export interface StoreBrainDataParams {
  proofId: string;
  milestoneText: string;
  proofText: string;
  modelVotes: ModelVote[];
  consensusLevel: number; // number of YES votes (0–5)
  finalDecision: "YES" | "NO";
}

/**
 * Determines label and source from consensus level + final decision.
 * 4-1 or 5-0 → auto-stored in TrainingEntry.
 * 3-2 → queued for human review.
 */
function getLabelSource(yesCount: number): "AUTO_5_0" | "AUTO_4_1" | "HUMAN_QUEUE" {
  if (yesCount === 5 || yesCount === 0) return "AUTO_5_0";
  if (yesCount === 4 || yesCount === 1) return "AUTO_4_1";
  return "HUMAN_QUEUE"; // 3-2 split
}

function decisionToLabel(decision: "YES" | "NO"): "APPROVED" | "REJECTED" {
  return decision === "YES" ? "APPROVED" : "REJECTED";
}

/**
 * Fire-and-forget webhook notification when a new entry lands in the human review queue.
 * Uses REVIEW_QUEUE_WEBHOOK_URL env var (optional). Never throws.
 */
async function notifyReviewQueue(entry: {
  proofId: string;
  milestoneText: string;
  consensusLevel: number;
}): Promise<void> {
  const url = process.env.REVIEW_QUEUE_WEBHOOK_URL;
  if (!url) return;
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔍 *Human review needed* — 3-2 split on proof \`${entry.proofId}\`\nMilestone: ${entry.milestoneText.slice(0, 120)}…\nConsensus: ${entry.consensusLevel}/5\n→ ${baseUrl}/internal/review`,
        proofId: entry.proofId,
        milestoneText: entry.milestoneText,
        consensusLevel: entry.consensusLevel,
        reviewUrl: `${baseUrl}/internal/review`,
      }),
    });
  } catch {
    // notification failure must never affect the main flow
  }
}

/**
 * Called after every AI verification (fire-and-forget).
 * Stores training data and embeddings invisibly in the background.
 * Never throws — all errors are logged only.
 */
export async function storeBrainData(params: StoreBrainDataParams): Promise<void> {
  try {
    const { proofId, milestoneText, proofText, modelVotes, consensusLevel, finalDecision } = params;
    const yesCount = modelVotes.filter((v) => v.decision === "YES").length;
    const source = getLabelSource(yesCount);

    if (source === "HUMAN_QUEUE") {
      // Look up the original file URL so reviewers can open the actual document
      const proof = await prisma.proof.findUnique({ where: { id: proofId }, select: { fileUrl: true } });
      const fileUrl = proof?.fileUrl ?? null;

      const isNew = !(await prisma.humanReviewQueue.findUnique({ where: { proofId }, select: { id: true } }));

      await prisma.humanReviewQueue.upsert({
        where: { proofId },
        create: {
          proofId,
          milestoneText,
          proofText: proofText.slice(0, 10_000),
          fileUrl,
          modelVotes: modelVotes as never,
          consensusLevel,
        },
        update: {
          modelVotes: modelVotes as never,
          consensusLevel,
          // Reset skipped/reviewed state if proof was re-verified
          skippedAt: null,
        },
      });

      // Only notify once per proof (not on re-verification)
      if (isNew) {
        notifyReviewQueue({ proofId, milestoneText, consensusLevel });
      }
    } else {
      // High consensus → auto-label and store in training dataset
      await prisma.trainingEntry.create({
        data: {
          proofId,
          milestoneText,
          proofText: proofText.slice(0, 10_000),
          label: decisionToLabel(finalDecision),
          labelSource: source,
          modelVotes: modelVotes as never,
          consensusLevel,
        },
      });
    }

    // Generate and store embedding regardless of consensus level
    const combinedText = `Milestone: ${milestoneText}\n\nProof:\n${proofText.slice(0, 3_000)}`;
    const embedding = await generateEmbedding(combinedText);
    if (embedding) {
      await storeProofEmbedding(proofId, embedding);
    }
  } catch (err) {
    console.warn("[brain/training] storeBrainData failed (non-fatal):", err);
  }
}

/**
 * Called from the internal review tool when a human labels a queued entry.
 * Moves the entry from HumanReviewQueue to TrainingEntry.
 */
export async function labelQueueEntry(params: {
  proofId: string;
  label: "APPROVED" | "REJECTED" | "FAKED";
  fraudType?: string;
  notes?: string;
}): Promise<void> {
  const { proofId, label, fraudType, notes } = params;

  const queued = await prisma.humanReviewQueue.findUnique({ where: { proofId } });
  if (!queued) throw new Error("Queue entry not found");

  await prisma.$transaction([
    prisma.trainingEntry.create({
      data: {
        proofId,
        milestoneText: queued.milestoneText,
        proofText: queued.proofText,
        label,
        labelSource: "HUMAN",
        fraudType: fraudType ?? null,
        modelVotes: queued.modelVotes ?? [],
        consensusLevel: queued.consensusLevel,
        notes: notes ?? null,
      },
    }),
    prisma.humanReviewQueue.update({
      where: { proofId },
      data: {
        label,
        fraudType: fraudType ?? null,
        notes: notes ?? null,
        reviewedAt: new Date(),
        skippedAt: null,
      },
    }),
  ]);
}

/**
 * Undo the last label on a queue entry.
 * Deletes the TrainingEntry and resets the HumanReviewQueue row back to pending.
 * Safe to call even if the TrainingEntry was already deleted.
 */
export async function undoLabelQueueEntry(proofId: string): Promise<void> {
  await prisma.$transaction([
    // deleteMany won't throw if the row doesn't exist
    prisma.trainingEntry.deleteMany({ where: { proofId, labelSource: "HUMAN" } }),
    prisma.humanReviewQueue.update({
      where: { proofId },
      data: { label: null, fraudType: null, notes: null, reviewedAt: null, skippedAt: null },
    }),
  ]);
}

/**
 * Mark a queue entry as skipped so it doesn't appear in the pending list.
 * The reviewer can still see it in the "Skipped" tab and un-skip it.
 */
export async function skipQueueEntry(proofId: string): Promise<void> {
  await prisma.humanReviewQueue.update({
    where: { proofId },
    data: { skippedAt: new Date() },
  });
}

/** Stats for the internal dashboard. */
export async function getBrainStats() {
  const [trainingCount, queueCount, embeddingCount, labelBreakdown, consensusBreakdown, recentEntries] = await Promise.all([
    prisma.trainingEntry.count(),
    prisma.humanReviewQueue.count({ where: { reviewedAt: null, skippedAt: null } }),
    prisma.proofEmbedding.count(),
    prisma.trainingEntry.groupBy({ by: ["label"], _count: true }),
    prisma.trainingEntry.groupBy({ by: ["consensusLevel"], _count: true }),
    prisma.trainingEntry.findMany({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, label: true },
      where: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  const byDay = new Map<string, { date: string; total: number; approved: number; rejected: number; faked: number }>();
  for (const e of recentEntries) {
    const day = e.createdAt.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { date: day, total: 0, approved: 0, rejected: 0, faked: 0 });
    const d = byDay.get(day)!;
    d.total++;
    if (e.label === "APPROVED") d.approved++;
    else if (e.label === "REJECTED") d.rejected++;
    else if (e.label === "FAKED") d.faked++;
  }

  return {
    trainingCount,
    pendingReviewCount: queueCount,
    embeddingCount,
    labelBreakdown: Object.fromEntries(labelBreakdown.map((b) => [b.label, b._count])),
    consensusBreakdown: consensusBreakdown
      .sort((a, b) => a.consensusLevel - b.consensusLevel)
      .map((b) => ({ consensus: `${b.consensusLevel}/5`, count: b._count })),
    timeSeries: Array.from(byDay.values()),
  };
}
