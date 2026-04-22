import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encrypt";
import { writeXrplAuditMemo } from "@/services/xrpl/audit-xrpl.service";
import { fetchUrl } from "./fetchers/url-scrape";
import { fetchRestApi } from "./fetchers/rest-api";
import { generateAttestationCert } from "./cert.service";
import { sendAttestationResultEmail } from "@/lib/email";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

export interface AttestationRunResult {
  entryId: string;
  verdict: "YES" | "NO" | "INCONCLUSIVE";
  reasoning: string;
  fetchedHash: string;
  xrplTxHash: string | null;
  certUrl: string | null;
}

/**
 * Runs a full attestation cycle for one milestone:
 * 1. Fetch data source (URL, REST API, or file already uploaded)
 * 2. Hash the raw content
 * 3. Store raw blob to Vercel Blob for audit
 * 4. Run AI evaluation (Claude Haiku)
 * 5. Write result to XRPL
 * 6. Generate attestation certificate
 * 7. Create AttestationEntry in DB
 * 8. Update milestone status + cert URL
 * 9. Notify auditor if set
 */
export async function runAttestation(
  milestoneId: string,
  period: string,
  triggeredBy: "PLATFORM" | "CRON" | "MANUAL" = "PLATFORM"
): Promise<AttestationRunResult> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: true },
  });

  if (!milestone) throw new Error(`Milestone ${milestoneId} not found`);
  if (milestone.contract.mode !== "ATTESTATION") {
    throw new Error("runAttestation called on a non-ATTESTATION milestone");
  }
  if (!milestone.dataSourceLockedAt) {
    throw new Error("Data source must be locked before running attestation");
  }

  // ── 1. Fetch data source ──────────────────────────────────────────────────
  let rawContent: string;
  const sourceType = milestone.dataSourceType;

  if (sourceType === "URL_SCRAPE") {
    if (!milestone.dataSourceUrl) throw new Error("dataSourceUrl not set");
    const result = await fetchUrl(milestone.dataSourceUrl);
    rawContent = result.content;
  } else if (sourceType === "REST_API") {
    if (!milestone.dataSourceUrl) throw new Error("dataSourceUrl not set");
    if (!milestone.dataSourceApiKeyEnc) throw new Error("dataSourceApiKeyEnc not set");
    const apiKey = decryptApiKey(milestone.dataSourceApiKeyEnc);
    const config = (milestone.dataSourceConfig as Record<string, unknown> | null) ?? {};
    const result = await fetchRestApi(milestone.dataSourceUrl, apiKey, {
      method: (config.method as string) ?? "GET",
      headers: (config.headers as Record<string, string>) ?? {},
      responsePath: (config.responsePath as string) ?? undefined,
    });
    rawContent = result.content;
  } else if (sourceType === "FILE_UPLOAD") {
    if (!milestone.attestationFetchedBlob) {
      throw new Error("FILE_UPLOAD source has no attestationFetchedBlob set");
    }
    // Only allow fetching from Vercel Blob storage — never arbitrary user-controlled URLs
    const blobHost = new URL(milestone.attestationFetchedBlob).hostname;
    if (!blobHost.endsWith(".vercel-storage.com") && !blobHost.endsWith(".public.blob.vercel-storage.com")) {
      throw new Error("FILE_UPLOAD blob URL points to an untrusted host");
    }
    const res = await fetch(milestone.attestationFetchedBlob);
    rawContent = await res.text();
  } else if (sourceType === "MANUAL_REVIEW") {
    // MANUAL_REVIEW verdict is set externally — this path shouldn't be called by the runner
    throw new Error("MANUAL_REVIEW sources are not processed by the automated runner");
  } else {
    throw new Error(`Unknown dataSourceType: ${sourceType}`);
  }

  // ── 2. Hash raw content ───────────────────────────────────────────────────
  const fetchedHash = crypto.createHash("sha256").update(rawContent).digest("hex");
  const fetchedAt = new Date();

  // ── 3. Store raw blob ─────────────────────────────────────────────────────
  let fetchedBlobUrl: string | null = null;
  try {
    const blob = await put(
      `attestation/${milestoneId}/${period}-${fetchedHash.slice(0, 8)}.txt`,
      rawContent,
      { access: "public", contentType: "text/plain" }
    );
    fetchedBlobUrl = blob.url;
  } catch (err) {
    console.warn("[attestation] blob upload failed, continuing without it:", err);
  }

  // ── 4. AI evaluation ──────────────────────────────────────────────────────
  const anthropic = getAnthropic();

  const systemPrompt = `You are an independent KPI verification agent for cascrow, an enterprise attestation platform.
Your job is to evaluate whether a business milestone or KPI has been achieved based on evidence fetched from a pre-committed data source.

Rules:
- Answer YES if the evidence clearly shows the milestone is met
- Answer NO if the evidence clearly shows it is not met
- Answer INCONCLUSIVE only if the evidence is ambiguous, incomplete, or cannot be reliably interpreted
- Be factual and specific — reference exact figures or statements from the evidence
- Do not infer or assume data that is not in the evidence
- Respond ONLY with valid JSON (no markdown): {"verdict": "YES"|"NO"|"INCONCLUSIVE", "reasoning": "2-3 sentence explanation referencing specific evidence"}`;

  const userPrompt = `Milestone to verify:
Title: ${milestone.title}
${milestone.description ? `Description: ${milestone.description}` : ""}
Deadline: ${milestone.cancelAfter.toISOString().slice(0, 10)}

Evidence fetched from ${sourceType} on ${fetchedAt.toISOString()}:
---
${rawContent.slice(0, 8_000)}
---

Does the evidence show this milestone is met?`;

  let verdict: "YES" | "NO" | "INCONCLUSIVE" = "INCONCLUSIVE";
  let reasoning = "AI evaluation failed — verdict set to INCONCLUSIVE.";

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    const parsed = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()) as {
      verdict?: string;
      reasoning?: string;
    };

    if (["YES", "NO", "INCONCLUSIVE"].includes(parsed.verdict ?? "")) {
      verdict = parsed.verdict as "YES" | "NO" | "INCONCLUSIVE";
    }
    if (parsed.reasoning) reasoning = parsed.reasoning;

    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd:
          (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "attestation-verification",
      },
    }).catch(() => {});
  } catch (err) {
    console.error("[attestation] AI evaluation failed:", err);
  }

  // ── 5. Write to XRPL ──────────────────────────────────────────────────────
  const xrplTxHash = await writeXrplAuditMemo({
    event: "ATTESTATION_RUN",
    contractId: milestone.contractId,
    milestoneId: milestone.id,
    actor: triggeredBy,
    metadata: { period, verdict, fetchedHash, sourceType },
  });

  // ── 6. Generate certificate ───────────────────────────────────────────────
  let certUrl: string | null = null;
  try {
    certUrl = await generateAttestationCert({
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      period,
      verdict,
      reasoning,
      fetchedHash,
      fetchedAt,
      sourceType: sourceType ?? "FILE_UPLOAD",
      xrplTxHash,
    });
  } catch (err) {
    console.warn("[attestation] cert generation failed:", err);
  }

  // ── 7. Create AttestationEntry ────────────────────────────────────────────
  const entry = await prisma.attestationEntry.create({
    data: {
      milestoneId: milestone.id,
      period,
      fetchedAt,
      fetchedHash,
      fetchedBlobUrl,
      aiVerdict: verdict,
      aiReasoning: reasoning,
      xrplTxHash,
      certUrl,
      type: "PLATFORM",
    },
  });

  // ── 8. Update milestone fields ────────────────────────────────────────────
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      attestationFetchedAt: fetchedAt,
      attestationFetchedHash: fetchedHash,
      attestationFetchedBlob: fetchedBlobUrl,
      attestationCertUrl: certUrl,
      status: verdict === "YES" ? "COMPLETED" : verdict === "NO" ? "REJECTED" : "PENDING_REVIEW",
      schedulePreviousRun: fetchedAt,
    },
  });

  // ── 9. Notify auditor ─────────────────────────────────────────────────────
  const auditorEmail = milestone.contract.auditorEmail;
  if (auditorEmail) {
    sendAttestationResultEmail({
      to: auditorEmail,
      milestoneTitle: milestone.title,
      period,
      verdict,
      reasoning,
      certUrl,
      xrplTxHash,
      contractId: milestone.contractId,
    }).catch((err) => console.warn("[attestation] auditor email failed:", err));
  }

  return { entryId: entry.id, verdict, reasoning, fetchedHash, xrplTxHash, certUrl };
}
