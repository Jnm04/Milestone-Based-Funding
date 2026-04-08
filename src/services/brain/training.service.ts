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
      // 3-2 split → queue for human review, don't auto-label
      await prisma.humanReviewQueue.upsert({
        where: { proofId },
        create: {
          proofId,
          milestoneText,
          proofText: proofText.slice(0, 10_000),
          modelVotes: modelVotes as never,
          consensusLevel,
        },
        update: {
          modelVotes: modelVotes as never,
          consensusLevel,
        },
      });
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
      },
    }),
  ]);
}

/** Stats for the internal dashboard. */
export async function getBrainStats() {
  const [trainingCount, queueCount, embeddingCount, labelBreakdown] = await Promise.all([
    prisma.trainingEntry.count(),
    prisma.humanReviewQueue.count({ where: { reviewedAt: null } }),
    prisma.proofEmbedding.count(),
    prisma.trainingEntry.groupBy({ by: ["label"], _count: true }),
  ]);
  return {
    trainingCount,
    pendingReviewCount: queueCount,
    embeddingCount,
    labelBreakdown: Object.fromEntries(labelBreakdown.map((b) => [b.label, b._count])),
  };
}
