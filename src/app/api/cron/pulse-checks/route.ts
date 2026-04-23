/**
 * GET /api/cron/pulse-checks
 * Vercel Cron Job — runs weekly (every Monday at 07:00 UTC).
 *
 * Feature II: Early Warning / Trend Monitoring.
 * For each recurring ATTESTATION milestone with pulseCheckEnabled=true,
 * fetches the data source, runs a lightweight AI trend check (does NOT
 * write to chain), and sends an early warning email if the data suggests
 * the target is at risk of being missed.
 *
 * Does NOT create AttestationEntry records (no official run).
 * Privacy: if the owner improves and the next official run passes, there
 * is no on-chain evidence that a warning was ever issued.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { sendEarlyWarningEmail, sendPredictiveMissEmail } from "@/lib/email";
import { fetchUrl } from "@/services/attestation/fetchers/url-scrape";
import { fetchRestApi } from "@/services/attestation/fetchers/rest-api";
import { decryptApiKey } from "@/lib/encrypt";
import { computePrediction } from "@/services/attestation/predictor.service";
import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

function currentPeriod(scheduleType: string): string {
  const now = new Date();
  if (scheduleType === "MONTHLY") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (scheduleType === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  if (scheduleType === "ANNUAL") return String(now.getFullYear());
  return now.toISOString().slice(0, 10);
}

function shouldRunPulseCheck(
  interval: string | null,
  lastPulseCheckAt: Date | null
): boolean {
  if (!interval) return false;
  const now = new Date();
  if (!lastPulseCheckAt) return true;

  const msSince = now.getTime() - lastPulseCheckAt.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (interval === "WEEKLY") return msSince >= 7 * day;
  if (interval === "BIWEEKLY") return msSince >= 14 * day;
  if (interval === "MID_PERIOD") return msSince >= 14 * day; // approx mid-period check
  return false;
}

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const milestones = await prisma.milestone.findMany({
    where: {
      pulseCheckEnabled: true,
      dataSourceLockedAt: { not: null },
      dataSourceType: { not: "MANUAL_REVIEW" },
      scheduleType: { in: ["MONTHLY", "QUARTERLY", "ANNUAL"] },
      status: { notIn: ["COMPLETED", "REJECTED", "EXPIRED"] },
      contract: { mode: "ATTESTATION" },
    },
    include: {
      contract: {
        select: {
          id: true,
          milestone: true,
          investorId: true,
          investor: { select: { email: true } },
        },
      },
    },
  });

  const results: { milestoneId: string; status: string; risk?: string; error?: string }[] = [];

  for (const milestone of milestones) {
    if (!shouldRunPulseCheck(milestone.pulseCheckInterval, milestone.lastPulseCheckAt)) {
      results.push({ milestoneId: milestone.id, status: "skipped" });
      continue;
    }

    try {
      // Fetch data source (same as runner, but no chain write)
      let rawContent: string;
      if (milestone.dataSourceType === "URL_SCRAPE") {
        if (!milestone.dataSourceUrl) throw new Error("No URL");
        const r = await fetchUrl(milestone.dataSourceUrl);
        rawContent = r.content;
      } else if (milestone.dataSourceType === "REST_API") {
        if (!milestone.dataSourceUrl || !milestone.dataSourceApiKeyEnc) throw new Error("No REST config");
        const apiKey = decryptApiKey(milestone.dataSourceApiKeyEnc);
        const config = (milestone.dataSourceConfig as Record<string, unknown> | null) ?? {};
        const r = await fetchRestApi(milestone.dataSourceUrl, apiKey, {
          method: (config.method as string) ?? "GET",
          headers: (config.headers as Record<string, string>) ?? {},
          responsePath: (config.responsePath as string) ?? undefined,
        });
        rawContent = r.content;
      } else if (milestone.dataSourceType === "FILE_UPLOAD") {
        if (!milestone.attestationFetchedBlob) throw new Error("No file blob");
        const blobHost = new URL(milestone.attestationFetchedBlob).hostname;
        if (!blobHost.endsWith(".vercel-storage.com") && !blobHost.endsWith(".public.blob.vercel-storage.com")) {
          throw new Error("Untrusted blob host");
        }
        const res = await fetch(milestone.attestationFetchedBlob);
        rawContent = await res.text();
      } else {
        results.push({ milestoneId: milestone.id, status: "skipped", error: "Unsupported source type" });
        continue;
      }

      // AI trend assessment — lightweight, no chain write
      const anthropic = getAnthropic();
      const period = currentPeriod(milestone.scheduleType ?? "MONTHLY");

      const sysPrompt = `You are a KPI trend analyst for cascrow. Given current data from a pre-committed source, assess whether a milestone is on track.
Respond ONLY with valid JSON:
{"risk":"ON_TRACK"|"AT_RISK"|"LIKELY_MISS","assessment":"1-2 sentence explanation","extractedValue":"current metric value e.g. €4.2M","targetValue":"what the milestone requires e.g. €5M","confidence":0.85}`;

      const userMsg = `Milestone: ${milestone.title}
${milestone.description ? `Goal: ${milestone.description}` : ""}
Deadline: ${milestone.cancelAfter.toISOString().slice(0, 10)}
Current period: ${period}

Current data:
---
${rawContent.slice(0, 6_000)}
---

Is this milestone on track to be met by the deadline?`;

      const aiResp = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 256,
        system: sysPrompt,
        messages: [{ role: "user", content: userMsg }],
      });

      const rawText = aiResp.content[0]?.type === "text" ? aiResp.content[0].text.trim() : "{}";
      const parsed = JSON.parse(
        rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
      ) as { risk?: string; assessment?: string; extractedValue?: string; targetValue?: string; confidence?: number };

      const risk = (["ON_TRACK", "AT_RISK", "LIKELY_MISS"].includes(parsed.risk ?? "")
        ? parsed.risk
        : "AT_RISK") as "ON_TRACK" | "AT_RISK" | "LIKELY_MISS";

      const assessment = parsed.assessment ?? "Trend data could not be assessed.";
      const extractedValue = parsed.extractedValue ?? null;
      const targetValue = parsed.targetValue ?? null;
      const aiConfidence = typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5;

      void prisma.apiUsage.create({
        data: {
          model: "Claude Haiku",
          inputTokens: aiResp.usage.input_tokens,
          outputTokens: aiResp.usage.output_tokens,
          estimatedCostUsd:
            (0.8 * aiResp.usage.input_tokens + 4.0 * aiResp.usage.output_tokens) / 1_000_000,
          context: "pulse-check",
        },
      }).catch(() => {});

      // Save snapshot for predictive analysis (Feature VI)
      await prisma.pulseCheckSnapshot.create({
        data: {
          milestoneId: milestone.id,
          risk,
          rawValue: extractedValue,
          targetValue,
          confidence: aiConfidence,
        },
      });

      // Update pulse check fields
      const prevRisk = milestone.lastPulseCheckRisk;
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: {
          lastPulseCheckAt: new Date(),
          lastPulseCheckRisk: risk,
        },
      });

      // Run prediction after snapshot (Feature VI)
      const prediction = await computePrediction(milestone.id).catch(() => null);

      // Send early warning email when at risk
      if (risk !== "ON_TRACK") {
        const ownerEmail = milestone.contract.investor.email;
        if (ownerEmail) {
          await sendEarlyWarningEmail({
            to: ownerEmail,
            milestoneTitle: milestone.title,
            contractId: milestone.contract.id,
            risk: risk as "AT_RISK" | "LIKELY_MISS",
            aiAssessment: assessment,
            period,
          }).catch((err) => console.warn("[pulse-checks] email failed:", err));
        }
      }

      // Send predictive miss email if prediction flipped to NO/INCONCLUSIVE (Feature VI)
      if (
        prediction &&
        (prediction.predictedOutcome === "NO" || prediction.predictedOutcome === "INCONCLUSIVE") &&
        prevRisk === "ON_TRACK"
      ) {
        const ownerEmail = milestone.contract.investor.email;
        if (ownerEmail) {
          await sendPredictiveMissEmail({
            to: ownerEmail,
            milestoneTitle: milestone.title,
            contractId: milestone.contract.id,
            predictedOutcome: prediction.predictedOutcome,
            confidence: prediction.confidence,
            weeksToDeadline: prediction.weeksToDeadline,
            lastRawValue: prediction.lastRawValue,
            targetValue,
          }).catch((err) => console.warn("[pulse-checks] predictive miss email failed:", err));
        }
      }

      results.push({ milestoneId: milestone.id, status: "done", risk });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[cron/pulse-checks] failed for milestone ${milestone.id}:`, err);

      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { lastPulseCheckAt: new Date() },
      }).catch(() => {});

      results.push({ milestoneId: milestone.id, status: "error", error: message });
    }
  }

  return NextResponse.json({
    processed: results.length,
    warned: results.filter((r) => r.risk && r.risk !== "ON_TRACK").length,
    results,
  });
}
