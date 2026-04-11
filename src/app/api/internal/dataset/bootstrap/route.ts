import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyMilestone } from "@/services/ai/verifier.service";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, storeProofEmbedding } from "@/services/brain/embedding.service";

export const maxDuration = 60;

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

const DOMAINS = ["legal", "technical", "business", "research"] as const;
const OUTCOMES = ["approved", "rejected"] as const;

const DOMAIN_CONTEXT: Record<string, string> = {
  legal:     "legal compliance, GDPR assessments, regulatory filings, data protection policies",
  technical: "software MVP delivery, API deployment, mobile app launch, working prototype",
  business:  "revenue milestones, user signups, B2B partnerships, pilot customers, sales targets",
  research:  "literature review, feasibility study, user interviews, competitive analysis report",
};

const OUTCOME_INSTRUCTION: Record<string, string> = {
  approved: "The proof document CLEARLY demonstrates the milestone was completed. Include specific dates, results, and deliverables.",
  rejected: "The proof is a plan or concept document — NOT completed work. The milestone criteria are NOT met.",
};

async function generatePair(
  domain: string,
  outcome: string,
  index: number
): Promise<{ milestoneText: string; proofText: string } | null> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const companies = ["Nexora GmbH", "BluePath Technologies", "VerdeTech UG", "Arkana Systems",
      "Solveig Labs", "Luminos AG", "DataVault GmbH", "CoreShift Ltd"];
    const company = companies[(index * 3 + domain.length) % companies.length];

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "You generate realistic startup milestone+proof pairs for a training dataset. Return ONLY valid JSON.",
      messages: [{
        role: "user",
        content: `Generate one milestone+proof pair.
Company: ${company}
Domain: ${DOMAIN_CONTEXT[domain]}
Outcome: ${OUTCOME_INSTRUCTION[outcome]}

Return ONLY this JSON (proofText max 300 words):
{"milestoneText":"2-3 sentence milestone with specific deliverable","proofText":"200-300 word realistic proof document"}`,
      }],
    });

    const raw = msg.content[0];
    if (raw.type !== "text") return null;
    const cleaned = raw.text.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { milestoneText: string; proofText: string };
    return parsed.milestoneText && parsed.proofText ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/internal/dataset/bootstrap
 * Generates synthetic training pairs across all domains and outcomes,
 * runs 5-model verification, and auto-saves high-consensus results (>=4/5).
 * Returns a summary of what was saved.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 422 });
  }

  const body = await req.json().catch(() => ({})) as { pairsPerCombo?: number };
  const pairsPerCombo = Math.min(Math.max(1, body.pairsPerCombo ?? 2), 3);

  // Build all jobs: 4 domains × 2 outcomes × pairsPerCombo
  const jobs = DOMAINS.flatMap((domain) =>
    OUTCOMES.flatMap((outcome) =>
      Array.from({ length: pairsPerCombo }, (_, i) => ({ domain, outcome, index: i }))
    )
  );

  // Generate all pairs in parallel (Claude Haiku is fast and cheap)
  const pairs = await Promise.all(
    jobs.map(async (job) => {
      const pair = await generatePair(job.domain, job.outcome, job.index);
      return pair ? { ...pair, domain: job.domain, outcome: job.outcome } : null;
    })
  );
  const validPairs = pairs.filter((p): p is NonNullable<typeof p> => p !== null);

  if (validPairs.length === 0) {
    return NextResponse.json({ error: "All generation attempts failed." }, { status: 422 });
  }

  // Run 5-model verification on all pairs in parallel
  const verified = await Promise.all(
    validPairs.map(async (pair) => {
      try {
        const result = await verifyMilestone({ milestone: pair.milestoneText, extractedText: pair.proofText });
        return { ...pair, result };
      } catch {
        return null;
      }
    })
  );
  const verifiedPairs = verified.filter((v): v is NonNullable<typeof v> => v !== null);

  // Save high-consensus results (>=4/5) to TrainingEntry
  let saved = 0;
  let queued = 0;

  await Promise.all(verifiedPairs.map(async (v) => {
    const { milestoneText, proofText, result } = v;
    const yesCount = result.modelVotes.filter((m) => m.decision === "YES").length;
    const labelSource = yesCount === 5 || yesCount === 0 ? "AUTO_5_0" : "AUTO_4_1";
    const label = result.decision === "YES" ? "APPROVED" : "REJECTED";
    const proofId = `bootstrap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (yesCount >= 4 || yesCount <= 1) {
      // High consensus — auto-save
      try {
        await prisma.trainingEntry.create({
          data: {
            proofId,
            milestoneText,
            proofText: proofText.slice(0, 10_000),
            label,
            labelSource,
            modelVotes: result.modelVotes as never,
            consensusLevel: yesCount,
            notes: `Bootstrap: ${v.domain}/${v.outcome}`,
          },
        });
        saved++;
        // Fire-and-forget embedding
        void generateEmbedding(`Milestone: ${milestoneText}\n\nProof:\n${proofText.slice(0, 3_000)}`)
          .then((emb) => emb && storeProofEmbedding(proofId, emb))
          .catch(() => {});
      } catch { /* skip duplicates */ }
    } else {
      // 3-2 split — queue for human review
      try {
        await prisma.humanReviewQueue.upsert({
          where: { proofId },
          create: { proofId, milestoneText, proofText: proofText.slice(0, 10_000), fileUrl: null, modelVotes: result.modelVotes as never, consensusLevel: yesCount },
          update: { modelVotes: result.modelVotes as never },
        });
        queued++;
      } catch { /* skip */ }
    }
  }));

  return NextResponse.json({
    ok: true,
    generated: validPairs.length,
    verified: verifiedPairs.length,
    saved,
    queued,
  });
}
