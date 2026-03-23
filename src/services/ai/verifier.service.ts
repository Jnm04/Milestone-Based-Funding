import Anthropic from "@anthropic-ai/sdk";
import { AIVerificationResult } from "@/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

export type FileCategory = "pdf" | "image" | "office" | "text";

export function categorizeFile(mimeType: string, fileName: string): FileCategory {
  if (mimeType === "application/pdf" || /\.pdf$/i.test(fileName)) return "pdf";
  if (mimeType.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName)) return "image";
  if (["text/csv", "text/plain"].includes(mimeType) || /\.(csv|txt|md)$/i.test(fileName)) return "text";
  return "office";
}

/** Extracts text from a PDF buffer. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text.trim();
}

/** Extracts text from DOCX, PPTX, XLSX using officeparser. */
export async function extractOfficeText(buffer: Buffer, fileName: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const officeParser = require("officeparser");
  const text: string = await officeParser.parseOfficeAsync(buffer, {
    outputErrorToConsole: false,
    newlineDelimiter: "\n",
    ignoreNotes: false,
    putTextInOrder: true,
    tempFilesLocation: "/tmp",
  });
  return text.trim();
}

const PROMPT_SUFFIX = `\n\nRespond with ONLY a JSON object:\n{\n  "decision": "YES" or "NO",\n  "reasoning": "Brief explanation (2-3 sentences)",\n  "confidence": 0-100\n}`;

async function callClaude(messages: Anthropic.MessageParam[]): Promise<AIVerificationResult> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

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

/** Verifies milestone against extracted text (PDF, Office, CSV). */
export async function verifyMilestone(params: {
  milestone: string;
  extractedText: string;
}): Promise<AIVerificationResult> {
  const prompt = `You are a milestone verification agent. Compare the uploaded proof document against the following milestone criteria and determine if the milestone has been met.\n\nMilestone: ${params.milestone}\n\nDocument content:\n${params.extractedText.slice(0, 8000)}${PROMPT_SUFFIX}`;

  return callClaude([{ role: "user", content: prompt }]);
}

/** Verifies milestone against an image (PNG, JPG, WEBP, GIF) using Claude Vision. */
export async function verifyMilestoneImage(params: {
  milestone: string;
  imageBuffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<AIVerificationResult> {
  const base64 = params.imageBuffer.toString("base64");
  const prompt = `You are a milestone verification agent. Examine the uploaded image and determine if it proves that the following milestone has been met.\n\nMilestone: ${params.milestone}${PROMPT_SUFFIX}`;

  return callClaude([{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: params.mimeType, data: base64 } },
      { type: "text", text: prompt },
    ],
  }]);
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
