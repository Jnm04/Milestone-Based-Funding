import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

/** Generate a text embedding. Returns null if OpenAI key is missing. */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await getOpenAI().embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // ~2k tokens, well within limits
    });
    return response.data[0].embedding;
  } catch (err) {
    console.warn("[brain/embedding] Failed to generate embedding:", err);
    return null;
  }
}

/** Store embedding for a proof. Silently skips if embedding is null. */
export async function storeProofEmbedding(proofId: string, embedding: number[]): Promise<void> {
  try {
    await prisma.proofEmbedding.upsert({
      where: { proofId },
      create: {
        proofId,
        embedding: JSON.stringify(embedding),
        model: EMBEDDING_MODEL,
      },
      update: {
        embedding: JSON.stringify(embedding),
        model: EMBEDDING_MODEL,
      },
    });
  } catch (err) {
    console.warn("[brain/embedding] Failed to store embedding:", err);
  }
}

/** Cosine similarity between two vectors. */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < EMBEDDING_DIMS; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SimilarProof {
  proofId: string;
  similarity: number;
  milestoneText: string;
  label: string;
  consensusLevel: number;
}

/**
 * Find the top-k most similar past proofs from the training dataset.
 * Used to build RAG context for AI verification.
 */
export async function findSimilarProofs(
  embedding: number[],
  limit = 5
): Promise<SimilarProof[]> {
  try {
    // Load all embeddings from DB (fast enough up to ~50k entries)
    const all = await prisma.proofEmbedding.findMany({
      select: { proofId: true, embedding: true },
    });

    // Load training entries for those proofIds
    const trainingMap = new Map<string, { milestoneText: string; label: string; consensusLevel: number }>();
    const entries = await prisma.trainingEntry.findMany({
      where: { proofId: { in: all.map((e) => e.proofId) } },
      select: { proofId: true, milestoneText: true, label: true, consensusLevel: true },
    });
    for (const e of entries) trainingMap.set(e.proofId, e);

    const scored = all
      .map((e) => {
        const vec = JSON.parse(e.embedding) as number[];
        const sim = cosineSimilarity(embedding, vec);
        const training = trainingMap.get(e.proofId);
        return training ? { proofId: e.proofId, similarity: sim, ...training } : null;
      })
      .filter((e): e is SimilarProof => e !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return scored;
  } catch (err) {
    console.warn("[brain/embedding] Failed to find similar proofs:", err);
    return [];
  }
}

/** Build a RAG context string from similar past proofs to inject into AI prompts. */
export async function buildRAGContext(milestoneText: string, proofText: string): Promise<string> {
  try {
    const combinedText = `Milestone: ${milestoneText}\n\nProof summary: ${proofText.slice(0, 500)}`;
    const embedding = await generateEmbedding(combinedText);
    if (!embedding) return "";

    const similar = await findSimilarProofs(embedding, 3);
    if (similar.length === 0) return "";

    const lines = similar.map(
      (s) =>
        `- ${s.label} (consensus ${s.consensusLevel}/5, similarity ${(s.similarity * 100).toFixed(0)}%): "${s.milestoneText.slice(0, 100)}"`
    );

    return `\n\n[HISTORICAL CONTEXT — similar past decisions]\n${lines.join("\n")}\n[END HISTORICAL CONTEXT]`;
  } catch {
    return "";
  }
}
