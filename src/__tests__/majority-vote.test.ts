import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all heavy imports before loading the module
vi.mock("@anthropic-ai/sdk", () => ({ default: class {} }));
vi.mock("@google/genai", () => ({ GoogleGenAI: class {} }));
vi.mock("openai", () => ({ default: class {} }));
vi.mock("@mistralai/mistralai", () => ({ Mistral: class {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { apiUsage: { create: vi.fn() } } }));

const { combineResults } = await import("@/services/ai/verifier.service");

type Vote = { model: string; result: { decision: "YES" | "NO"; confidence: number; reasoning: string } };

function makeVote(model: string, decision: "YES" | "NO", confidence = 80): Vote {
  return { model, result: { decision, confidence, reasoning: `${model} says ${decision}` } };
}

describe("5-model majority vote", () => {
  it("YES when 3 of 5 vote YES", () => {
    const votes = [
      makeVote("Claude", "YES"),
      makeVote("GPT", "YES"),
      makeVote("Gemini", "YES"),
      makeVote("Mistral", "NO"),
      makeVote("Cerebras", "NO"),
    ];
    expect(combineResults(votes).decision).toBe("YES");
  });

  it("NO when only 2 of 5 vote YES", () => {
    const votes = [
      makeVote("Claude", "YES"),
      makeVote("GPT", "YES"),
      makeVote("Gemini", "NO"),
      makeVote("Mistral", "NO"),
      makeVote("Cerebras", "NO"),
    ];
    expect(combineResults(votes).decision).toBe("NO");
  });

  it("YES when all 5 vote YES", () => {
    const votes = [
      makeVote("Claude", "YES", 95),
      makeVote("GPT", "YES", 90),
      makeVote("Gemini", "YES", 88),
      makeVote("Mistral", "YES", 85),
      makeVote("Cerebras", "YES", 92),
    ];
    const result = combineResults(votes);
    expect(result.decision).toBe("YES");
    expect(result.consensusLevel).toBe(5);
  });

  it("consensusLevel equals number of YES votes", () => {
    const votes = [
      makeVote("Claude", "YES"),
      makeVote("GPT", "YES"),
      makeVote("Gemini", "YES"),
      makeVote("Mistral", "NO"),
      makeVote("Cerebras", "YES"),
    ];
    expect(combineResults(votes).consensusLevel).toBe(4);
  });

  it("confidence is average of majority voters", () => {
    const votes = [
      makeVote("Claude", "YES", 80),
      makeVote("GPT", "YES", 90),
      makeVote("Gemini", "YES", 70),
      makeVote("Mistral", "NO", 60),
      makeVote("Cerebras", "NO", 55),
    ];
    const result = combineResults(votes);
    // Average of YES voters: (80+90+70)/3 = 80
    expect(result.confidence).toBe(80);
  });

  it("handles 3-model partial response (2 failed) — still votes correctly", () => {
    const votes = [
      makeVote("Claude", "YES"),
      makeVote("GPT", "YES"),
      makeVote("Gemini", "NO"),
    ];
    // 2 YES out of 3 — below 3/5 threshold → NO
    expect(combineResults(votes).decision).toBe("NO");
  });

  it("reasoning includes vote breakdown", () => {
    const votes = [
      makeVote("Claude", "YES"),
      makeVote("GPT", "YES"),
      makeVote("Gemini", "YES"),
      makeVote("Mistral", "NO"),
      makeVote("Cerebras", "NO"),
    ];
    const { reasoning } = combineResults(votes);
    expect(reasoning).toContain("3/5");
  });
});
