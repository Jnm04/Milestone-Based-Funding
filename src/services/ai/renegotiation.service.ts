/**
 * Feature F: AI Milestone Renegotiation
 * Haiku assesses whether a startup's interim progress update makes extension plausible.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

let _client: Anthropic | null = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface RenegotiationAssessment {
  plausible: boolean;
  assessment: string;
  concerns: string[];
}

/**
 * Calls Claude Haiku to assess whether the startup's interim update makes
 * completion within the requested extension window plausible.
 */
export async function assessInterimUpdate({
  milestoneTitle,
  interimUpdateText,
  extensionDays,
}: {
  milestoneTitle: string;
  interimUpdateText: string;
  extensionDays: number;
}): Promise<RenegotiationAssessment> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // No key — return a neutral assessment so the UI still works
    return {
      plausible: true,
      assessment: "AI assessment unavailable (no API key configured).",
      concerns: [],
    };
  }

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are a milestone deadline extension analyst for a grant escrow platform.
A startup missed a milestone deadline and is requesting an extension. They have submitted a progress update describing what they have done so far.
Assess whether completing the milestone within the requested extension period is plausible based on their update.
Be factual, concise, and impartial. Do not blame either party.
Respond ONLY with valid JSON (no markdown, no code fences): { "plausible": true/false, "assessment": "2 sentence summary", "concerns": ["..."] }
plausible = true means the progress update provides credible evidence that completion within the extension window is achievable.
concerns: max 3 specific concerns, or an empty array if none.`,
    messages: [
      {
        role: "user",
        content: `Milestone: "${milestoneTitle}"
Requested extension: ${extensionDays} days
Startup's progress update:
"${interimUpdateText}"

Assess whether completing this milestone within ${extensionDays} additional days is plausible.`,
      },
    ],
  });

  // Log usage (non-fatal)
  void prisma.apiUsage
    .create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd:
          (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "renegotiation",
      },
    })
    .catch(() => {});

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

  try {
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(jsonText) as RenegotiationAssessment;
    return {
      plausible: Boolean(parsed.plausible),
      assessment: String(parsed.assessment ?? "No assessment provided."),
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String) : [],
    };
  } catch {
    console.error("[renegotiation] JSON parse failed. Raw:", rawText);
    return {
      plausible: false,
      assessment: "AI assessment could not be parsed. The Grant Giver will decide.",
      concerns: [],
    };
  }
}
