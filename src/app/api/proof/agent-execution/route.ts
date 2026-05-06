import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { sendProofSubmittedEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import crypto from "crypto";

/**
 * POST /api/proof/agent-execution
 *
 * Structured proof endpoint for AI agents — accepts a JSON execution trace
 * instead of a file upload. The agent describes what it did, which model ran,
 * which tools were called, and what artifacts were produced.
 *
 * Auth: API key (Bearer csk_…) OR active session.
 * Rate limit: 10 per user per hour.
 *
 * Body: AgentExecutionProofBody (see schema below)
 * Response: { proofId, milestoneId, proofType: "agent_execution" }
 */

const toolCallSchema = z.object({
  tool: z.string().max(100),
  inputSummary: z.string().max(500).optional(),
  outputSummary: z.string().max(500).optional(),
  timestamp: z.string().datetime().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

const artifactSchema = z.object({
  type: z.enum(["file", "url", "code", "report", "other"]),
  description: z.string().max(300),
  hash: z.string().max(128).optional(),
  url: z.string().url().max(2000).optional(),
});

const schema = z.object({
  milestoneId: z.string().cuid("Invalid milestoneId"),
  agentModel: z.string().max(120),
  agentProvider: z.string().max(80),
  agentVersion: z.string().max(80).optional(),
  executionId: z.string().max(200).optional(),
  frameworkVersion: z.string().max(100).optional(),
  toolCalls: z.array(toolCallSchema).max(200).optional(),
  tokenUsage: z.object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    totalTokens: z.number().int().nonnegative().optional(),
  }).optional(),
  outputSummary: z.string().min(20, "outputSummary must be at least 20 characters").max(4000),
  outputArtifacts: z.array(artifactSchema).max(50).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

type AgentExecutionBody = z.infer<typeof schema>;

async function triggerVerification(proofId: string) {
  try {
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ proofId }),
    });
  } catch (err) {
    console.error("[agent-execution/auto-verify] failed:", err);
  }
}

/**
 * Formats structured agent execution metadata into a human + AI readable text block.
 * This becomes extractedText, which is what the 5-model verifier reads.
 */
function formatExecutionText(data: AgentExecutionBody): string {
  const lines: string[] = [];

  lines.push("== AI AGENT EXECUTION PROOF ==");
  lines.push("");
  lines.push(`Agent Model : ${data.agentModel} (${data.agentProvider})`);
  if (data.agentVersion) lines.push(`Agent Version: ${data.agentVersion}`);
  if (data.frameworkVersion) lines.push(`Framework    : ${data.frameworkVersion}`);
  if (data.executionId) lines.push(`Execution ID : ${data.executionId}`);

  if (data.startedAt || data.completedAt) {
    const start = data.startedAt ?? "—";
    const end = data.completedAt ?? "—";
    let durationNote = "";
    if (data.startedAt && data.completedAt) {
      const ms = new Date(data.completedAt).getTime() - new Date(data.startedAt).getTime();
      durationNote = ` (${Math.round(ms / 1000)}s)`;
    }
    lines.push(`Duration     : ${start} → ${end}${durationNote}`);
  }

  if (data.tokenUsage) {
    const { inputTokens, outputTokens, totalTokens } = data.tokenUsage;
    const parts = [];
    if (inputTokens != null) parts.push(`${inputTokens.toLocaleString()} input`);
    if (outputTokens != null) parts.push(`${outputTokens.toLocaleString()} output`);
    if (totalTokens != null && parts.length === 0) parts.push(`${totalTokens.toLocaleString()} total`);
    if (parts.length > 0) lines.push(`Token Usage  : ${parts.join(" / ")}`);
  }

  lines.push("");
  lines.push("== WORK SUMMARY ==");
  lines.push(data.outputSummary);

  if (data.toolCalls && data.toolCalls.length > 0) {
    lines.push("");
    lines.push(`== TOOL CALLS (${data.toolCalls.length} total) ==`);
    data.toolCalls.slice(0, 100).forEach((tc, i) => {
      const ts = tc.timestamp ? `[${tc.timestamp.slice(11, 19)}] ` : "";
      const input = tc.inputSummary ? ` — input: "${tc.inputSummary}"` : "";
      const output = tc.outputSummary ? ` → "${tc.outputSummary}"` : "";
      const dur = tc.durationMs != null ? ` (${tc.durationMs}ms)` : "";
      lines.push(`${i + 1}. ${ts}${tc.tool}${input}${output}${dur}`);
    });
    if (data.toolCalls.length > 100) {
      lines.push(`... and ${data.toolCalls.length - 100} more tool calls (truncated)`);
    }
  }

  if (data.outputArtifacts && data.outputArtifacts.length > 0) {
    lines.push("");
    lines.push("== OUTPUT ARTIFACTS ==");
    data.outputArtifacts.forEach((a, i) => {
      const hash = a.hash ? ` (SHA-256: ${a.hash})` : "";
      const url = a.url ? ` — ${a.url}` : "";
      lines.push(`${i + 1}. [${a.type}] ${a.description}${hash}${url}`);
    });
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  // ── Auth: session OR API key ──────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  let userId: string | null = session?.user?.id ?? null;

  if (!userId) {
    const ctx = await resolveApiKey(request.headers.get("authorization"));
    if (ctx) userId = ctx.userId;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  if (!(await checkRateLimit(`proof-agent-execution:${userId}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many agent execution proofs. Try again in an hour." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // ── Parse + validate body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // ── Milestone lookup + auth check ─────────────────────────────────────────
  const milestone = await prisma.milestone.findUnique({
    where: { id: data.milestoneId },
    include: { contract: { include: { investor: true, startup: true } } },
  });

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (milestone.contract.startupId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(milestone.status)) {
    return NextResponse.json(
      { error: `Cannot submit proof for milestone in status: ${milestone.status}` },
      { status: 409 }
    );
  }

  // ── Build extracted text + hash ───────────────────────────────────────────
  const extractedText = formatExecutionText(data);
  const fileHash = crypto.createHash("sha256").update(extractedText).digest("hex");
  const fileUrl = `agent-execution://${data.agentProvider}/${data.agentModel}/${fileHash.slice(0, 16)}`;

  // ── Create proof ──────────────────────────────────────────────────────────
  const proof = await prisma.proof.create({
    data: {
      contractId: milestone.contractId,
      milestoneId: data.milestoneId,
      fileUrl,
      fileName: `AI Agent: ${data.agentModel}`,
      fileHash,
      extractedText,
      proofType: "agent_execution",
      agentExecutionMetadata: data as object,
    },
  });

  await prisma.milestone.update({
    where: { id: data.milestoneId },
    data: { status: "PROOF_SUBMITTED" },
  });
  await prisma.contract.update({
    where: { id: milestone.contractId },
    data: { status: "PROOF_SUBMITTED" },
  });

  if (milestone.contract.investor.notifyProofSubmitted) {
    void sendProofSubmittedEmail({
      to: milestone.contract.investor.email,
      contractId: milestone.contractId,
      milestoneTitle: milestone.title,
      startupName: milestone.contract.startup?.companyName ?? milestone.contract.startup?.name,
      investorId: milestone.contract.investorId,
    }).catch((err) => console.error("[email] sendProofSubmittedEmail failed:", err));
  }

  await writeAuditLog({
    contractId: milestone.contractId,
    milestoneId: data.milestoneId,
    event: "PROOF_SUBMITTED",
    actor: userId,
    metadata: {
      proofId: proof.id,
      proofType: "agent_execution",
      agentModel: data.agentModel,
      agentProvider: data.agentProvider,
      fileHash,
    },
  });

  void fireWebhook({
    investorId: milestone.contract.investorId,
    startupId: milestone.contract.startupId ?? undefined,
    event: "proof.submitted",
    contractId: milestone.contractId,
    milestoneId: data.milestoneId,
    data: {
      proofId: proof.id,
      proofType: "agent_execution",
      agentModel: data.agentModel,
      agentProvider: data.agentProvider,
      milestoneTitle: milestone.title,
    },
  }).catch((err) => console.error("[webhook] proof.submitted failed:", err));

  void triggerVerification(proof.id);

  return NextResponse.json(
    {
      proofId: proof.id,
      milestoneId: data.milestoneId,
      proofType: "agent_execution",
      message: "Execution proof submitted. AI verification is running.",
    },
    { status: 201 }
  );
}
