import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { AIVerificationResult } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const GEMINI_MODEL = "gemini-2.5-flash";

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

function parseAIResponse(raw: string, source: string): AIVerificationResult {
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  let parsed: AIVerificationResult;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`${source} returned invalid JSON: ${cleaned}`);
  }
  if (parsed.decision !== "YES" && parsed.decision !== "NO") {
    throw new Error(`${source} returned unexpected decision: ${parsed.decision}`);
  }
  return {
    decision: parsed.decision,
    reasoning: parsed.reasoning ?? "",
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
  };
}

async function callClaude(messages: Anthropic.MessageParam[]): Promise<AIVerificationResult> {
  const message = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages,
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");
  return parseAIResponse(content.text, "Claude");
}

async function callGeminiText(prompt: string): Promise<AIVerificationResult> {
  const result = await geminiClient.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
  });
  const text = result.text ?? "";
  return parseAIResponse(text, "Gemini");
}

async function callGeminiImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<AIVerificationResult> {
  const result = await geminiClient.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { parts: [{ text: prompt }, { inlineData: { mimeType, data: imageBase64 } }] },
    ],
  });
  const text = result.text ?? "";
  return parseAIResponse(text, "Gemini");
}

/**
 * Combines Claude and Gemini results using AND logic:
 * Both must say YES for the final decision to be YES.
 * If they disagree, returns NO with the dissenting model's reasoning.
 */
function combineResults(
  claude: AIVerificationResult,
  gemini: AIVerificationResult
): AIVerificationResult {
  if (claude.decision === "YES" && gemini.decision === "YES") {
    return {
      decision: "YES",
      reasoning: `Both models approved. Claude: ${claude.reasoning} Gemini: ${gemini.reasoning}`,
      confidence: Math.round((claude.confidence + gemini.confidence) / 2),
    };
  }

  // At least one said NO
  const dissenter = claude.decision === "NO" ? claude : gemini;
  const dissenterName = claude.decision === "NO" ? "Claude" : "Gemini";
  return {
    decision: "NO",
    reasoning: `${dissenterName} rejected the proof: ${dissenter.reasoning}`,
    confidence: dissenter.confidence,
  };
}

/** Verifies milestone against extracted text (PDF, Office, CSV). */
export async function verifyMilestone(params: {
  milestone: string;
  extractedText: string;
}): Promise<AIVerificationResult> {
  const prompt = `You are a milestone verification agent. Compare the uploaded proof document against the following milestone criteria and determine if the milestone has been met.\n\nMilestone: ${params.milestone}\n\nDocument content:\n${params.extractedText.slice(0, 8000)}${PROMPT_SUFFIX}`;

  const [claude, gemini] = await Promise.all([
    callClaude([{ role: "user", content: prompt }]),
    callGeminiText(prompt),
  ]);

  return combineResults(claude, gemini);
}

/** Verifies milestone against an image using Claude Vision + Gemini Vision. */
export async function verifyMilestoneImage(params: {
  milestone: string;
  imageBuffer: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<AIVerificationResult> {
  const base64 = params.imageBuffer.toString("base64");
  const prompt = `You are a milestone verification agent. Examine the uploaded image and determine if it proves that the following milestone has been met.\n\nMilestone: ${params.milestone}${PROMPT_SUFFIX}`;

  const [claude, gemini] = await Promise.all([
    callClaude([{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: params.mimeType, data: base64 } },
        { type: "text", text: prompt },
      ],
    }]),
    callGeminiImage(prompt, base64, params.mimeType),
  ]);

  return combineResults(claude, gemini);
}

/**
 * Mock verifier for development without real API keys.
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
