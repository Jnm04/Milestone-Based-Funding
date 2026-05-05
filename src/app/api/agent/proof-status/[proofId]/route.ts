import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";

// GET /api/agent/proof-status/[proofId]
// Returns the current AI verification result for a submitted proof.
// Only the agent who owns the contract (as investor or startup) may read it.
// Agents use this to poll after cascrow_submit_proof / cascrow_mcp_submit without
// having to re-fetch the full contract.
// Rate limited: 60 req / min per agent.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  if (!(await checkRateLimit(`agent-proof-status:${apiKeyCtx.userId}`, 60, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before retrying." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { proofId } = await params;

  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    select: {
      id:           true,
      contractId:   true,
      milestoneId:  true,
      aiDecision:   true,
      aiConfidence: true,
      aiReasoning:  true,
      aiObjections: true,
      createdAt:    true,
      contract: {
        select: {
          investorId: true,
          startupId:  true,
          status:     true,
        },
      },
      milestone: {
        select: {
          id:     true,
          status: true,
          title:  true,
        },
      },
    },
  });

  if (!proof) {
    return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  }

  const { investorId, startupId } = proof.contract;
  if (investorId !== apiKeyCtx.userId && startupId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // aiDecision is null while verification is still running
  const pending = proof.aiDecision === null;

  return NextResponse.json({
    proofId:       proof.id,
    contractId:    proof.contractId,
    milestoneId:   proof.milestoneId ?? null,
    pending,
    decision:      proof.aiDecision   ?? null,   // "YES" | "NO" | null (still running)
    confidence:    proof.aiConfidence ?? null,
    reasoning:     proof.aiReasoning  ?? null,
    objections:    proof.aiObjections ?? null,
    contractStatus: proof.contract.status,
    milestoneStatus: proof.milestone?.status ?? null,
    milestoneTitle:  proof.milestone?.title  ?? null,
    submittedAt:   proof.createdAt,
  });
}
