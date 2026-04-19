import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const HAIKU_INPUT_PER_M  = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;
const MAX_TEXT_CHARS = 20_000;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

/**
 * Feature V — Proof TL;DR
 *
 * Generates a 3-5 bullet JSON array describing what evidence is present in the proof.
 * Called fire-and-forget from proof/upload and proof/github after the proof record is created.
 * Only shown to investors — not the startup (they know what they submitted).
 */
export async function generateAndStoreProofSummary(opts: {
  proofId: string;
  milestoneTitle: string;
  extractedText: string | null;
}): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;
  if (!opts.extractedText || opts.extractedText.trim().length < 50) return;

  try {
    const text = opts.extractedText.slice(0, MAX_TEXT_CHARS);

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a proof content analyst for a milestone escrow platform.
Given a proof document (PDF text or GitHub data), list exactly what evidence is present.
Be factual and specific. Do not evaluate whether the milestone is met — only describe what is there.
Respond ONLY with valid JSON: an array of 3-5 strings.
Each string starts with a concrete observation. Flag missing items only if clearly expected from the milestone description.
Example: ["Live product URL screenshot showing 14 registered users", "GitHub repository with 47 commits over 3 weeks", "Short product demo video link included"]`,
      messages: [
        {
          role: "user",
          content: `Milestone: ${opts.milestoneTitle}\n\nProof content:\n${text}`,
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
          context: "proof-summary",
        },
      })
      .catch(() => {});

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (!raw) return;

    // Tolerate Haiku wrapping the JSON in markdown code fences
    const clean = raw.replace(/^```json?\n?/i, "").replace(/\n?```$/i, "").trim();

    let items: string[] = [];
    try {
      const parsed: unknown = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        items = parsed.filter((s): s is string => typeof s === "string").slice(0, 5);
      }
    } catch {
      return; // malformed JSON — skip silently
    }

    if (items.length === 0) return;

    await prisma.proof.update({
      where: { id: opts.proofId },
      data: { aiContentSummary: JSON.stringify(items) },
    });
  } catch (err) {
    console.error(
      "[proof-summary] Summary generation failed for proof",
      opts.proofId,
      err
    );
  }
}
