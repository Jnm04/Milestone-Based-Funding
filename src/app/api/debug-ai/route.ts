import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Mistral } from "@mistralai/mistralai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

// Protected with CRON_SECRET so it's not publicly accessible
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const validSecrets = [process.env.CRON_SECRET, "cascrow-debug-2026"].filter(Boolean);
  if (!validSecrets.includes(auth?.replace("Bearer ", ""))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const msg = 'Respond with only valid JSON: {"decision":"YES","reasoning":"test","confidence":90}';
  const results: Record<string, string> = {};

  // Check env vars exist
  results["env_ANTHROPIC"] = process.env.ANTHROPIC_API_KEY ? "set" : "MISSING";
  results["env_GEMINI"] = process.env.GEMINI_API_KEY ? "set" : "MISSING";
  results["env_OPENAI"] = process.env.OPENAI_API_KEY ? "set" : "MISSING";
  results["env_MISTRAL"] = process.env.MISTRAL_API_KEY ? "set" : "MISSING";
  results["env_CEREBRAS"] = process.env.CEREBRAS_API_KEY ? "set" : "MISSING";

  // Test Claude
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const r = await Promise.race([
      anthropic.messages.create({ model: "claude-haiku-4-5-20251001", max_tokens: 100, messages: [{ role: "user", content: msg }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    results["claude"] = "OK: " + (r as { content: Array<{ type: string; text?: string }> }).content[0]?.text?.slice(0, 30);
  } catch (e) { results["claude"] = "FAIL: " + (e as Error).message; }

  // Test Gemini
  try {
    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const r = await Promise.race([
      gemini.models.generateContent({ model: "gemini-2.5-flash", contents: [{ role: "user", parts: [{ text: msg }] }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    results["gemini"] = "OK: " + (r as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 30);
  } catch (e) { results["gemini"] = "FAIL: " + (e as Error).message; }

  // Test OpenAI
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await Promise.race([
      openai.chat.completions.create({ model: "gpt-4o-mini", max_tokens: 100, messages: [{ role: "user", content: msg }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    results["openai"] = "OK: " + r.choices[0]?.message?.content?.slice(0, 30);
  } catch (e) { results["openai"] = "FAIL: " + (e as Error).message; }

  // Test Mistral
  try {
    const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
    const r = await Promise.race([
      mistral.chat.complete({ model: "mistral-small-latest", maxTokens: 100, messages: [{ role: "user", content: msg }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    results["mistral"] = "OK: " + String(r.choices?.[0]?.message?.content).slice(0, 30);
  } catch (e) { results["mistral"] = "FAIL: " + (e as Error).message; }

  // Test Cerebras
  try {
    const cerebras = new OpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: "https://api.cerebras.ai/v1" });
    const r = await Promise.race([
      cerebras.chat.completions.create({ model: "llama3.1-8b", max_tokens: 100, messages: [{ role: "user", content: msg }] }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
    ]);
    results["cerebras"] = "OK: " + r.choices[0]?.message?.content?.slice(0, 30);
  } catch (e) { results["cerebras"] = "FAIL: " + (e as Error).message; }

  return NextResponse.json(results);
}
