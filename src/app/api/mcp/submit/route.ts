/**
 * POST /api/mcp/submit
 * MCP Verification Endpoint — Model Context Protocol compatible.
 *
 * Allows external AI agents to submit milestone evidence and trigger
 * Cascrow's 5-model verification pipeline programmatically.
 *
 * Auth: API key (Bearer csk_...) via existing resolveApiKey() infrastructure.
 *
 * Input:
 *   { contract_id, milestone_id, mode: "escrow"|"enterprise", evidence: { description, links?, github_commit?, revenue_amount?, custom_fields? } }
 *
 * Output:
 *   { verdict: "approved"|"rejected"|"pending_review", confidence: number, on_chain_url: string|null, signed_at: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyMilestone } from "@/services/ai/verifier.service";
import { writeAuditLog } from "@/services/evm/audit.service";

export const maxDuration = 60;

interface MCPEvidence {
  description: string;
  links?: string[];
  github_commit?: string;
  revenue_amount?: number;
  custom_fields?: Record<string, unknown>;
}

interface MCPSubmitBody {
  contract_id: string;
  milestone_id?: string;
  mode?: "escrow" | "enterprise";
  evidence: MCPEvidence;
}

function buildExtractedText(evidence: MCPEvidence): string {
  const lines: string[] = ["=== MCP Agent Submission ===", ""];
  lines.push(`Description: ${evidence.description}`);
  if (evidence.links?.length) lines.push(`Links:\n${evidence.links.map((l) => `  - ${l}`).join("\n")}`);
  if (evidence.github_commit) lines.push(`GitHub commit: ${evidence.github_commit}`);
  if (evidence.revenue_amount !== undefined) lines.push(`Revenue amount: $${evidence.revenue_amount.toLocaleString()}`);
  if (evidence.custom_fields && Object.keys(evidence.custom_fields).length > 0) {
    lines.push("Custom fields:");
    for (const [k, v] of Object.entries(evidence.custom_fields)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const apiKeyContext = await resolveApiKey(authHeader);
  if (!apiKeyContext) {
    return NextResponse.json({ error: "Unauthorized — provide a valid API key as Bearer token" }, { status: 401 });
  }

  // Rate limit: 20 MCP submissions per user per hour
  const withinLimit = await checkRateLimit(`mcp-submit:${apiKeyContext.userId}`, 20, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json({ error: "Rate limit exceeded — max 20 submissions per hour" }, { status: 429 });
  }

  let body: MCPSubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contract_id, milestone_id, evidence } = body;

  if (!contract_id) return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
  if (!evidence?.description) return NextResponse.json({ error: "evidence.description is required" }, { status: 400 });

  // Load contract
  const contract = await prisma.contract.findUnique({
    where: { id: contract_id },
    include: { milestones: { orderBy: { order: "asc" } } },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Auth: caller must be investor or startup of this contract
  const isParty = contract.investorId === apiKeyContext.userId || contract.startupId === apiKeyContext.userId;
  if (!isParty) return NextResponse.json({ error: "Forbidden — you are not a party to this contract" }, { status: 403 });

  // Find milestone
  const milestone = milestone_id
    ? contract.milestones.find((m) => m.id === milestone_id)
    : contract.milestones.find((m) => !["COMPLETED", "EXPIRED"].includes(m.status));

  if (!milestone) return NextResponse.json({ error: "Milestone not found or no active milestone" }, { status: 404 });

  const milestoneTitle = milestone.title;
  const extractedText = buildExtractedText(evidence);

  // Run 5-model verification
  let verifyResult;
  try {
    verifyResult = await verifyMilestone({
      milestone: milestoneTitle,
      extractedText,
      verificationCriteria: milestone.verificationCriteria ?? null,
    });
  } catch (err) {
    console.error("[mcp/submit] Verification failed:", err);
    return NextResponse.json({ error: "Verification service unavailable" }, { status: 503 });
  }

  // Determine verdict
  let verdict: "approved" | "rejected" | "pending_review";
  if (verifyResult.confidence < 60) {
    verdict = "rejected";
  } else if (verifyResult.confidence <= 85) {
    verdict = "pending_review";
  } else if (verifyResult.decision === "YES") {
    verdict = "approved";
  } else {
    verdict = "rejected";
  }

  // Create proof record
  const proof = await prisma.proof.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone.id,
      fileUrl: `mcp://agent-submission/${Date.now()}`,
      fileName: "mcp-agent-submission.txt",
      extractedText,
      proofType: "mcp_agent",
      aiDecision: verifyResult.decision,
      aiReasoning: verifyResult.reasoning,
      aiConfidence: verifyResult.confidence,
      aiModelVotes: verifyResult.modelVotes as never,
    },
  });

  // Write audit log
  await writeAuditLog({
    contractId: contract.id,
    milestoneId: milestone.id,
    event: "MCP_SUBMISSION",
    actor: `api_key:${apiKeyContext.keyId}`,
    metadata: { verdict, confidence: verifyResult.confidence, proofId: proof.id },
  });

  // Update statuses if approved
  let onChainUrl: string | null = null;
  if (verdict === "approved") {
    await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "VERIFIED" as never } });
    await prisma.contract.update({ where: { id: contract.id }, data: { status: "VERIFIED" as never } });
  } else if (verdict === "rejected") {
    await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "REJECTED" as never } });
    await prisma.contract.update({ where: { id: contract.id }, data: { status: "REJECTED" as never } });
  } else {
    await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "PENDING_REVIEW" as never } });
    await prisma.contract.update({ where: { id: contract.id }, data: { status: "PENDING_REVIEW" as never } });
  }

  return NextResponse.json({
    verdict,
    confidence: verifyResult.confidence,
    reasoning: verifyResult.reasoning,
    model_votes: verifyResult.modelVotes,
    on_chain_url: onChainUrl,
    proof_id: proof.id,
    signed_at: new Date().toISOString(),
  });
}
