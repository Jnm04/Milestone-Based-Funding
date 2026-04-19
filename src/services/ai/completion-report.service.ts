import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const HAIKU_INPUT_PER_M  = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

/**
 * Feature L — AI Completion Report
 *
 * Generates a 2-3 sentence narrative for a completed milestone and stores it.
 * Called fire-and-forget from escrow/finish after a milestone transitions to COMPLETED.
 */
export async function generateAndStoreCompletionNarrative(opts: {
  milestoneId: string;
  milestoneTitle: string;
  projectDescription?: string | null;
  amountUSD: string;
  completedOnTime: boolean;
  approvedProofReasoning?: string | null;
}): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;

  try {
    const contextLines = [
      `Milestone: ${opts.milestoneTitle}`,
      opts.projectDescription ? `Project context: ${opts.projectDescription}` : null,
      `Grant amount: $${Number(opts.amountUSD).toLocaleString()} RLUSD`,
      `Delivered: ${opts.completedOnTime ? "on time" : "after deadline"}`,
      opts.approvedProofReasoning
        ? `AI verification notes: ${opts.approvedProofReasoning}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await getAnthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: `You are writing the narrative section of a milestone completion report for a grant escrow platform.
Write 2–3 sentences describing what was delivered and verified for this milestone.
Be professional, specific, and factual. Use passive voice ("was delivered", "was verified").
Do not mention company names, personal names, specific URLs, or revenue figures.
Respond with ONLY the sentences. No heading, no quotation marks, no markdown.`,
      messages: [
        {
          role: "user",
          content: `Write the completion narrative:\n\n${contextLines}`,
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
          context: "completion-report",
        },
      })
      .catch(() => {});

    const text =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : null;
    if (!text) return;

    await prisma.milestone.update({
      where: { id: opts.milestoneId },
      data: {
        completionNarrative: text,
        completionNarrativeAt: new Date(),
      },
    });
  } catch (err) {
    console.error(
      "[completion-report] Narrative generation failed for milestone",
      opts.milestoneId,
      err
    );
  }
}
