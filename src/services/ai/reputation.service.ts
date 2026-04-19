import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// ─── Pricing ──────────────────────────────────────────────────────────────────
const HAIKU_INPUT_PER_M  = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;

function logUsage(inputTokens: number, outputTokens: number) {
  const cost =
    (HAIKU_INPUT_PER_M * inputTokens + HAIKU_OUTPUT_PER_M * outputTokens) / 1_000_000;
  void prisma.apiUsage
    .create({ data: { model: "Claude Haiku", inputTokens, outputTokens, estimatedCostUsd: cost, context: "reputation" } })
    .catch(() => {});
}

// ─── Lazy client ─────────────────────────────────────────────────────────────
let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ─── Category taxonomy ────────────────────────────────────────────────────────
export const REPUTATION_CATEGORIES = ["MVP", "REVENUE", "PARTNERSHIP", "GITHUB", "BETA", "OTHER"] as const;
export type ReputationCategory = typeof REPUTATION_CATEGORIES[number];

const EMPTY_CATEGORIES: Record<ReputationCategory, number> = {
  MVP: 0, REVENUE: 0, PARTNERSHIP: 0, GITHUB: 0, BETA: 0, OTHER: 0,
};

// ─── Public types ─────────────────────────────────────────────────────────────
export interface ReputationCard {
  milestoneId: string;
  summary: string;
  category: ReputationCategory;
  amountUSD: string;
  completedAt: string;
}

export interface ReputationData {
  userId: string;
  displayName: string | null;
  totalCompleted: number;
  onTimeRate: number | null;
  avgAiConfidence: number | null;
  avgResubmissions: number | null;
  categories: Record<ReputationCategory, number>;
  publicCards: ReputationCard[];
  lastCalculatedAt: string;
}

// ─── generateReputationSummary ────────────────────────────────────────────────
// Produces a short, privacy-safe description of the milestone achievement.
// Called once per COMPLETED milestone, result stored in Milestone.reputationSummary.

export async function generateReputationSummary(opts: {
  milestoneId: string;
  milestoneTitle: string;
  milestoneDescription?: string;
  amountUSD: string;
}): Promise<{ summary: string; category: ReputationCategory }> {
  const { milestoneTitle, milestoneDescription, amountUSD } = opts;

  const userMsg = [
    `Milestone title: ${milestoneTitle}`,
    milestoneDescription ? `Context: ${milestoneDescription}` : null,
    `Grant amount: $${amountUSD} RLUSD`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await getAnthropic().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: `You are a startup milestone achievement summarizer for a grant escrow platform.
Given a completed milestone, produce a privacy-safe performance card.
Rules:
- Remove all company names, partner names, revenue figures, specific URLs, personal names
- Keep only the category and achievement type: e.g. "Shipped a functional MVP with active users"
- Be concise (1–2 sentences max)
- Assign one category from: MVP, REVENUE, PARTNERSHIP, GITHUB, BETA, OTHER
  - MVP: product launch, prototype, demo, app deployment
  - REVENUE: sales, customers, paying users, ARR, MRR
  - PARTNERSHIP: B2B deals, contracts signed, integrations
  - GITHUB: code repository, open-source, commits, releases
  - BETA: beta launch, waitlist, early users, pilot
  - OTHER: everything else

Respond ONLY with valid JSON: { "summary": "...", "category": "MVP" }`,
    messages: [{ role: "user", content: userMsg }],
  });

  logUsage(response.usage.input_tokens, response.usage.output_tokens);

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  // Strip markdown fences if present
  const clean = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: { summary?: string; category?: string } = {};
  try { parsed = JSON.parse(clean); } catch { /* fall through to defaults */ }

  const summary = typeof parsed.summary === "string" && parsed.summary.length > 0
    ? parsed.summary
    : "A milestone was successfully completed and verified by cascrow's AI.";

  const rawCat = typeof parsed.category === "string" ? parsed.category.toUpperCase() : "";
  const category: ReputationCategory = (REPUTATION_CATEGORIES as readonly string[]).includes(rawCat)
    ? (rawCat as ReputationCategory)
    : "OTHER";

  return { summary, category };
}

// ─── recalculateReputationScore ───────────────────────────────────────────────
// Recomputes the ReputationScore row for a startup from all their COMPLETED milestones.
// Idempotent — safe to call multiple times.

export async function recalculateReputationScore(startupId: string): Promise<void> {
  // Fetch all COMPLETED milestones for this startup across all contracts
  const milestones = await prisma.milestone.findMany({
    where: {
      status: "COMPLETED",
      contract: { startupId },
    },
    include: {
      contract: true,
      proofs: {
        where: { aiDecision: "YES" },
        orderBy: { createdAt: "asc" },
        select: { aiConfidence: true, createdAt: true },
      },
    },
  });

  if (milestones.length === 0) {
    // Upsert zeroed-out score so the public profile still shows a row
    await prisma.reputationScore.upsert({
      where: { userId: startupId },
      update: {
        totalCompleted: 0,
        onTimeRate: null,
        avgAiConfidence: null,
        avgResubmissions: null,
        categories: { ...EMPTY_CATEGORIES },
        lastCalculatedAt: new Date(),
      },
      create: {
        userId: startupId,
        totalCompleted: 0,
        onTimeRate: null,
        avgAiConfidence: null,
        avgResubmissions: null,
        categories: { ...EMPTY_CATEGORIES },
      },
    });
    return;
  }

  // ── On-time rate ──────────────────────────────────────────────────────────
  let onTimeCount = 0;
  for (const ms of milestones) {
    // "on time" = completed (updatedAt) before or on the deadline (cancelAfter)
    if (ms.updatedAt <= ms.cancelAfter) onTimeCount++;
  }
  const onTimeRate = milestones.length > 0 ? onTimeCount / milestones.length : null;

  // ── Average AI confidence ─────────────────────────────────────────────────
  const confidences = milestones
    .flatMap((ms) => ms.proofs.map((p) => p.aiConfidence))
    .filter((c): c is number => c !== null);
  const avgAiConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null;

  // ── Average resubmissions ─────────────────────────────────────────────────
  // Count total proofs per milestone, subtract 1 for the approved one
  const resubCounts = await Promise.all(
    milestones.map(async (ms) => {
      const total = await prisma.proof.count({ where: { milestoneId: ms.id } });
      return Math.max(0, total - 1);
    })
  );
  const avgResubmissions =
    resubCounts.length > 0
      ? resubCounts.reduce((a, b) => a + b, 0) / resubCounts.length
      : null;

  // ── Category counts ───────────────────────────────────────────────────────
  const categories: Record<ReputationCategory, number> = { ...EMPTY_CATEGORIES };
  for (const ms of milestones) {
    if (ms.reputationCategory) {
      const cat = ms.reputationCategory.toUpperCase() as ReputationCategory;
      if (cat in categories) categories[cat]++;
      else categories.OTHER++;
    } else {
      categories.OTHER++;
    }
  }

  await prisma.reputationScore.upsert({
    where: { userId: startupId },
    update: {
      totalCompleted: milestones.length,
      onTimeRate,
      avgAiConfidence,
      avgResubmissions,
      categories,
      lastCalculatedAt: new Date(),
    },
    create: {
      userId: startupId,
      totalCompleted: milestones.length,
      onTimeRate,
      avgAiConfidence,
      avgResubmissions,
      categories,
    },
  });
}

// ─── generateAndStoreReputationForMilestone ───────────────────────────────────
// Top-level function called fire-and-forget from escrow/finish when a milestone completes.
// 1. Generates the Haiku privacy-safe summary
// 2. Stores it on the Milestone record
// 3. Recalculates the startup's aggregate ReputationScore

export async function generateAndStoreReputationForMilestone(opts: {
  milestoneId: string;
  milestoneTitle: string;
  milestoneDescription?: string;
  amountUSD: string;
  startupId: string;
}): Promise<void> {
  try {
    const { summary, category } = await generateReputationSummary({
      milestoneId: opts.milestoneId,
      milestoneTitle: opts.milestoneTitle,
      milestoneDescription: opts.milestoneDescription,
      amountUSD: opts.amountUSD,
    });

    await prisma.milestone.update({
      where: { id: opts.milestoneId },
      data: { reputationSummary: summary, reputationCategory: category },
    });

    await recalculateReputationScore(opts.startupId);
  } catch (err) {
    // Non-fatal: reputation is a nice-to-have, never block fund release
    console.error("[reputation] Failed to generate reputation for milestone", opts.milestoneId, err);
  }
}
