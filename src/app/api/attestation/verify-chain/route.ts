import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyEvidenceChain, EvidenceChain } from "@/lib/evidence-chain";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlAllowed = await checkRateLimit(`verify-chain:${ip}`, 30, 60);
  if (!rlAllowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { entryId, rawContent, systemPrompt, userPrompt, aiResponse } = body as Record<string, string | undefined>;

  if (!entryId || typeof entryId !== "string" || entryId.length > 50) {
    return NextResponse.json({ error: "entryId required" }, { status: 400 });
  }

  const entry = await prisma.attestationEntry.findUnique({
    where: { id: entryId },
    select: { evidenceChain: true, xrplTxHash: true, fetchedAt: true },
  });

  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  if (!entry.evidenceChain) {
    return NextResponse.json({ error: "No evidence chain stored for this entry" }, { status: 404 });
  }

  const stored = entry.evidenceChain as unknown as EvidenceChain;

  const { valid, stepsVerified } = verifyEvidenceChain(stored, {
    rawContent,
    systemPrompt,
    userPrompt,
    aiResponse,
  });

  const firstFailingStep =
    stepsVerified.step0 === false ? 0 :
    stepsVerified.step1 === false ? 1 :
    stepsVerified.step2 === false ? 2 :
    stepsVerified.step3 === false ? 3 : null;

  return NextResponse.json({
    valid,
    chainRoot: stored.chainRoot,
    systemPromptVersion: stored.systemPromptVersion,
    stepsVerified,
    firstFailingStep,
  });
}
