import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";


function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * GET /api/internal/graph
 * Returns nodes (training entries + pending review) and edges (embedding similarity).
 * Used to render the interactive Brain Map graph.
 */
export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
  const [trainingEntries, queueEntries, embeddings] = await Promise.all([
    prisma.trainingEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 600,
      select: {
        proofId: true,
        milestoneText: true,
        proofText: true,
        label: true,
        consensusLevel: true,
        labelSource: true,
        fraudType: true,
        modelVotes: true,
        createdAt: true,
      },
    }),
    prisma.humanReviewQueue.findMany({
      where: { reviewedAt: null },
      select: {
        proofId: true,
        milestoneText: true,
        consensusLevel: true,
        createdAt: true,
      },
    }),
    prisma.proofEmbedding.findMany({
      select: { proofId: true, embedding: true },
    }),
  ]);

  // Build embedding lookup
  const embMap = new Map<string, number[]>();
  for (const e of embeddings) {
    try {
      embMap.set(e.proofId, JSON.parse(e.embedding) as number[]);
    } catch {
      // Malformed embedding — skip
    }
  }

  // Build nodes
  const nodes = [
    ...trainingEntries.map((e) => ({
      id: e.proofId,
      label: e.label as string,
      consensusLevel: e.consensusLevel,
      milestoneText: e.milestoneText.slice(0, 240),
      proofText: e.proofText.slice(0, 500),
      modelVotes: e.modelVotes,
      labelSource: e.labelSource,
      fraudType: e.fraudType ?? null,
      createdAt: e.createdAt.toISOString(),
      hasEmbedding: embMap.has(e.proofId),
    })),
    ...queueEntries.map((e) => ({
      id: e.proofId,
      label: "PENDING",
      consensusLevel: e.consensusLevel,
      milestoneText: e.milestoneText.slice(0, 240),
      labelSource: "HUMAN_QUEUE",
      fraudType: null,
      createdAt: e.createdAt.toISOString(),
      hasEmbedding: embMap.has(e.proofId),
    })),
  ];

  // Compute edges from embeddings — top-3 neighbors per node, similarity > 0.62
  const THRESHOLD = 0.62;
  const TOP_K = 3;

  const nodesWithEmb = nodes.filter((n) => n.hasEmbedding);
  const edgeSet = new Set<string>();
  const links: { source: string; target: string; similarity: number }[] = [];

  for (let i = 0; i < nodesWithEmb.length; i++) {
    const nodeA = nodesWithEmb[i];
    const embA = embMap.get(nodeA.id)!;
    const scored: { id: string; sim: number }[] = [];

    for (let j = 0; j < nodesWithEmb.length; j++) {
      if (i === j) continue;
      const nodeB = nodesWithEmb[j];
      const embB = embMap.get(nodeB.id)!;
      const sim = cosineSimilarity(embA, embB);
      if (sim >= THRESHOLD) scored.push({ id: nodeB.id, sim });
    }

    scored.sort((a, b) => b.sim - a.sim);

    for (const { id, sim } of scored.slice(0, TOP_K)) {
      const key = [nodeA.id, id].sort().join("||");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        links.push({ source: nodeA.id, target: id, similarity: Math.round(sim * 1000) / 1000 });
      }
    }
  }

  return NextResponse.json({
    nodes,
    links,
    meta: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      nodesWithEmbedding: nodesWithEmb.length,
      trainingCount: trainingEntries.length,
      pendingCount: queueEntries.length,
    },
  });
  } catch (err) {
    console.error("[internal/graph] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
  }
}
