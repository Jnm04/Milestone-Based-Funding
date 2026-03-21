import Anthropic from "@anthropic-ai/sdk";
import { AIVerificationResult } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

/**
 * Extracts text from a PDF buffer using pdf-parse.
 * Returns the raw text content.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text.trim();
}

/**
 * Sends extracted proof text + milestone criteria to Claude for binary YES/NO verification.
 * Returns structured decision, reasoning, and confidence score.
 */
export async function verifyMilestone(params: {
  milestone: string;
  extractedText: string;
}): Promise<AIVerificationResult> {
  const prompt = `You are a milestone verification agent. Compare the uploaded proof document against the following milestone criteria and determine if the milestone has been met.

Milestone: ${params.milestone}

Document content:
${params.extractedText.slice(0, 8000)}

Respond with ONLY a JSON object:
{
  "decision": "YES" or "NO",
  "reasoning": "Brief explanation (2-3 sentences)",
  "confidence": 0-100
}`;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  // Strip markdown code fences if present
  const raw = content.text.replace(/```json\n?|\n?```/g, "").trim();

  let parsed: AIVerificationResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw}`);
  }

  if (parsed.decision !== "YES" && parsed.decision !== "NO") {
    throw new Error(`Unexpected decision value: ${parsed.decision}`);
  }

  return {
    decision: parsed.decision,
    reasoning: parsed.reasoning ?? "",
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
  };
}

/**
 * Mock verifier for development without a real API key.
 * Always returns YES with 85% confidence.
 */
export function mockVerifyMilestone(params: {
  milestone: string;
  extractedText: string;
}): AIVerificationResult {
  console.warn("[AI] Using mock verifier — set ANTHROPIC_API_KEY for real verification");
  return {
    decision: "YES",
    reasoning: "Mock: Document uploaded successfully. Set ANTHROPIC_API_KEY for real AI verification.",
    confidence: 80,
  };
}
