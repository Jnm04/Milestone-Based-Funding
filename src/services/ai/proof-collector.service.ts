/**
 * Agentic Proof Collector
 * =======================
 * Runs 48 hours before a milestone deadline.
 * Automatically collects evidence from configured connectors (GitHub, Stripe)
 * and assembles a structured proof_package JSON.
 *
 * Creates a Draft proof (draftStatus="DRAFT") and emails the startup:
 * "We collected evidence automatically — review and confirm with one click."
 *
 * Only after explicit startup confirmation does the proof enter the verification pipeline.
 */

import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encrypt";
import { fetchGitHubProof } from "@/services/github/github.service";
import { put } from "@vercel/blob";
import crypto from "crypto";

export interface ProofPackage {
  collectedAt: string;
  milestoneId: string;
  milestoneTitle: string;
  sources: ProofSource[];
  summary: string;
}

interface ProofSource {
  type: "github" | "stripe";
  data: Record<string, unknown>;
}

interface StripeRevenueResult {
  totalRevenue: number;
  currency: string;
  subscriptionCount: number;
  periodStart: string;
  periodEnd: string;
}

async function collectGithubData(params: {
  repoUrl: string;
  tokenEnc: string | null;
  contractCreatedAt: Date;
}): Promise<ProofSource | null> {
  const { repoUrl, tokenEnc, contractCreatedAt } = params;

  // Temporarily inject decrypted token into env for the GitHub service
  const originalToken = process.env.GITHUB_TOKEN;
  if (tokenEnc) {
    try {
      process.env.GITHUB_TOKEN = decryptApiKey(tokenEnc);
    } catch {
      console.warn("[proof-collector] Failed to decrypt GitHub token, using public access");
    }
  }

  try {
    const doc = await fetchGitHubProof(repoUrl, contractCreatedAt);
    if (!doc) return null;
    return {
      type: "github",
      data: { repoUrl: doc.repoUrl, text: doc.text },
    };
  } finally {
    // Restore original token
    if (tokenEnc) {
      process.env.GITHUB_TOKEN = originalToken;
    }
  }
}

async function collectStripeData(params: {
  keyEnc: string;
  productId: string | null;
  periodStart: Date;
  periodEnd: Date;
}): Promise<ProofSource | null> {
  const { keyEnc, productId, periodStart, periodEnd } = params;

  let apiKey: string;
  try {
    apiKey = decryptApiKey(keyEnc);
  } catch {
    console.warn("[proof-collector] Failed to decrypt Stripe key");
    return null;
  }

  try {
    const startTs = Math.floor(periodStart.getTime() / 1000);
    const endTs = Math.floor(periodEnd.getTime() / 1000);

    // Fetch charges in period
    const chargesUrl = new URL("https://api.stripe.com/v1/charges");
    chargesUrl.searchParams.set("created[gte]", String(startTs));
    chargesUrl.searchParams.set("created[lte]", String(endTs));
    chargesUrl.searchParams.set("limit", "100");
    if (productId) chargesUrl.searchParams.set("expand[]", "data.payment_intent");

    const chargesRes = await fetch(chargesUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!chargesRes.ok) {
      console.warn("[proof-collector] Stripe charges API error:", chargesRes.status);
      return null;
    }

    type StripeCharge = { amount: number; currency: string; paid: boolean };
    type StripeList = { data: StripeCharge[] };
    const charges = (await chargesRes.json()) as StripeList;

    const totalRevenue = charges.data
      .filter((c) => c.paid)
      .reduce((sum, c) => sum + c.amount, 0) / 100;

    const currency = charges.data[0]?.currency?.toUpperCase() ?? "USD";

    // Fetch active subscriptions
    const subsRes = await fetch("https://api.stripe.com/v1/subscriptions?status=active&limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    type StripeSubs = { data: unknown[]; total_count?: number };
    const subs = subsRes.ok ? ((await subsRes.json()) as StripeSubs) : { data: [], total_count: 0 };

    const result: StripeRevenueResult = {
      totalRevenue,
      currency,
      subscriptionCount: subs.total_count ?? subs.data.length,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };

    // Cache snapshot in DB (fire-and-forget)
    void prisma.agentStripeSnapshot.create({
      data: {
        milestoneId: params.productId ?? "unknown",
        periodStart,
        periodEnd,
        revenueUsd: totalRevenue,
        subCount: result.subscriptionCount,
        rawJson: JSON.stringify(charges),
      },
    }).catch(() => {});

    return { type: "stripe", data: result as unknown as Record<string, unknown> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  } catch (err) {
    console.warn("[proof-collector] Stripe fetch failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function runCollectorForMilestone(milestoneId: string): Promise<boolean> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { include: { startup: true } } },
  });

  if (!milestone || !milestone.contract.startup) return false;
  if (!milestone.agentGithubRepo && !milestone.agentStripeKeyEnc) return false;
  if (milestone.agentProofDraftId) return false; // already collected

  const now = new Date();
  const sources: ProofSource[] = [];

  // Collect GitHub
  if (milestone.agentGithubRepo) {
    const gh = await collectGithubData({
      repoUrl: milestone.agentGithubRepo,
      tokenEnc: milestone.agentGithubTokenEnc,
      contractCreatedAt: milestone.contract.createdAt,
    });
    if (gh) sources.push(gh);
  }

  // Collect Stripe
  if (milestone.agentStripeKeyEnc) {
    const stripe = await collectStripeData({
      keyEnc: milestone.agentStripeKeyEnc,
      productId: milestone.agentStripeProductId,
      periodStart: milestone.contract.createdAt,
      periodEnd: now,
    });
    if (stripe) sources.push(stripe);
  }

  if (sources.length === 0) return false;

  const proofPackage: ProofPackage = {
    collectedAt: now.toISOString(),
    milestoneId,
    milestoneTitle: milestone.title,
    sources,
    summary: buildSummary(sources),
  };

  const packageJson = JSON.stringify(proofPackage, null, 2);
  const fileHash = crypto.createHash("sha256").update(packageJson).digest("hex");

  // Upload to Vercel Blob
  const blob = await put(
    `agent-proofs/${milestoneId}/${fileHash.slice(0, 8)}.json`,
    packageJson,
    { access: "public", contentType: "application/json" }
  );

  // Create DRAFT proof
  const draftProof = await prisma.proof.create({
    data: {
      contractId: milestone.contractId,
      milestoneId,
      fileUrl: blob.url,
      fileName: `agent-collected-${milestone.title.slice(0, 30)}.json`,
      fileHash,
      extractedText: buildExtractedText(proofPackage),
      proofType: "agent_collected",
      draftStatus: "DRAFT",
    },
  });

  // Mark milestone as collected
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { agentProofDraftId: draftProof.id, agentCollectedAt: now },
  });

  // Email startup
  const { sendAgentProofCollectedEmail } = await import("@/lib/email");
  await sendAgentProofCollectedEmail({
    to: milestone.contract.startup.email,
    contractId: milestone.contractId,
    milestoneTitle: milestone.title,
    proofId: draftProof.id,
    sourcesCount: sources.length,
    sourceTypes: sources.map((s) => s.type),
  }).catch((err) => console.warn("[proof-collector] email failed:", err));

  return true;
}

function buildSummary(sources: ProofSource[]): string {
  const parts: string[] = [];
  for (const s of sources) {
    if (s.type === "github") {
      parts.push("GitHub repository activity collected");
    } else if (s.type === "stripe") {
      const d = s.data as unknown as StripeRevenueResult;
      parts.push(`Stripe revenue: ${d.currency} ${d.totalRevenue.toFixed(2)}, ${d.subscriptionCount} active subscriptions`);
    }
  }
  return parts.join(". ");
}

function buildExtractedText(pkg: ProofPackage): string {
  const lines: string[] = [
    `=== Agentic Proof Package ===`,
    `Milestone: ${pkg.milestoneTitle}`,
    `Collected: ${pkg.collectedAt}`,
    `Sources: ${pkg.sources.length}`,
    "",
  ];
  for (const s of pkg.sources) {
    if (s.type === "github") {
      lines.push("--- GitHub Activity ---");
      lines.push((s.data.text as string | undefined) ?? "");
    } else if (s.type === "stripe") {
      const d = s.data as unknown as StripeRevenueResult;
      lines.push("--- Stripe Revenue Data ---");
      lines.push(`Period: ${d.periodStart} to ${d.periodEnd}`);
      lines.push(`Total Revenue: ${d.currency} ${d.totalRevenue.toFixed(2)}`);
      lines.push(`Active Subscriptions: ${d.subscriptionCount}`);
    }
    lines.push("");
  }
  return lines.join("\n").slice(0, 50_000);
}
