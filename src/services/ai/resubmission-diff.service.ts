import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const HAIKU_INPUT_PER_M  = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;
const MAX_TEXT_CHARS = 15_000;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

/**
 * Feature W — Resubmission Diff Intelligence
 *
 * When a startup resubmits after a rejection, this service compares the new proof
 * against the previous rejection reasoning and produces a structured diff:
 *   - addressed: objections that appear to have been resolved
 *   - stillOpen: objections that are still not addressed
 *
 * Called fire-and-forget from proof/upload and proof/github when a prior rejected
 * proof exists for the same milestone. Result shown only to the startup.
 */
export async function generateAndStoreResubmissionDiff(opts: {
  newProofId: string;
  milestoneTitle: string;
  previousReasoning: string;
  newExtractedText: string | null;
}): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;
  if (!opts.newExtractedText || opts.newExtractedText.trim().length < 30) return;

  try {
    const prevText = opts.previousReasoning.slice(0, 4_000);
    const newText  = opts.newExtractedText.slice(0, MAX_TEXT_CHARS);

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are an expert reviewer for a milestone escrow platform.
A startup had their proof rejected by AI and is now resubmitting.
Your job: compare the previous rejection reasoning to the new proof content and identify which objections have been addressed and which are still open.

Rules:
- Be specific and factual. Quote or paraphrase the original objection briefly.
- "addressed" = clear evidence in the new proof that resolves the objection
- "stillOpen" = no evidence found that addresses the objection
- If the new proof is unrelated to the milestone, list all objections as stillOpen.
- Respond ONLY with valid JSON in this exact shape:
  {"addressed": ["...", "..."], "stillOpen": ["...", "..."]}
- Each string is one concise sentence. 2–4 items per list (omit empty lists).
- Do not add any text outside the JSON.`,
      messages: [
        {
          role: "user",
          content: `Milestone: ${opts.milestoneTitle}

Previous rejection reasoning:
${prevText}

New proof content:
${newText}`,
        },
      ],
    });

    void prisma.apiUsage
      .create({
        data: {
          model: "Claude Haiku",
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          estimatedCostUsd:
            (HAIKU_INPUT_PER_M * response.usage.input_tokens +
              HAIKU_OUTPUT_PER_M * response.usage.output_tokens) /
            1_000_000,
          context: "resubmission-diff",
        },
      })
      .catch(() => {});

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!raw) return;

    // Tolerate markdown code fences
    const clean = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    let diff: { addressed?: string[]; stillOpen?: string[] } = {};
    try {
      const parsed: unknown = JSON.parse(clean);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        if (Array.isArray(p.addressed))
          diff.addressed = (p.addressed as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 4);
        if (Array.isArray(p.stillOpen))
          diff.stillOpen = (p.stillOpen as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 4);
      }
    } catch {
      return;
    }

    if (!diff.addressed?.length && !diff.stillOpen?.length) return;

    await prisma.proof.update({
      where: { id: opts.newProofId },
      data: { aiResubmissionDiff: JSON.stringify(diff) },
    });
  } catch (err) {
    console.error(
      "[resubmission-diff] Diff generation failed for proof",
      opts.newProofId,
      err
    );
  }
}
