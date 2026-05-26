/**
 * POST /api/mcp
 * GET  /api/mcp  (SSE keep-alive for clients that open a persistent channel)
 * DELETE /api/mcp (session close)
 *
 * Stateless MCP HTTP transport — one transport instance per request.
 * Auth: Authorization: Bearer <cascrow_api_key>
 * Used by Claude.ai web and Smithery (remote MCP).
 */

import { NextRequest, NextResponse } from "next/server";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const maxDuration = 120;

// ─── Shared helpers (parallel to cascrow-mcp/index.js) ───────────────────────

function makeHelpers(baseUrl: string, apiKey: string) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  async function apiPost(path: string, body: unknown) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    return data;
  }

  async function apiGet(path: string) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    return data;
  }

  async function apiPatch(path: string, body: unknown) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
    return data;
  }

  return { apiPost, apiGet, apiPatch };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "cascrow_create_contract",
    description:
      "Create a Cascrow verification contract with one or more milestones. " +
      "Each milestone defines a deliverable, its acceptance criteria, and a deadline. " +
      "Returns contractId, milestoneIds, and a link to view the contract. " +
      "Use this BEFORE starting any work so the user can see the plan.",
    inputSchema: {
      type: "object",
      required: ["milestones"],
      properties: {
        milestones: {
          type: "array",
          minItems: 1,
          description: "List of milestones to verify",
          items: {
            type: "object",
            required: ["title", "deadlineDays"],
            properties: {
              title: { type: "string", description: "Milestone title including acceptance criteria" },
              deadlineDays: { type: "number", description: "Days from now until deadline" },
              amountUSD: { type: "number", description: "Optional RLUSD amount to lock in escrow" },
            },
          },
        },
      },
    },
  },
  {
    name: "cascrow_fund_milestone",
    description: "Fund (activate) a milestone so it can receive proof.",
    inputSchema: {
      type: "object",
      required: ["contractId"],
      properties: {
        contractId: { type: "string" },
        milestoneId: { type: "string", description: "Optional; defaults to first available milestone" },
      },
    },
  },
  {
    name: "cascrow_escrow_fund",
    description:
      "Fund a milestone with real on-chain RLUSD escrow using the agent's own EVM private key.",
    inputSchema: {
      type: "object",
      required: ["contractId", "agentPrivateKey", "amountUSD"],
      properties: {
        contractId: { type: "string" },
        agentPrivateKey: { type: "string", description: "EVM private key (hex, 0x-prefixed)" },
        amountUSD: { type: "number" },
        milestoneId: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_submit_proof",
    description:
      "Submit proof of completion for a milestone. Write a detailed proof report with verifiable evidence.",
    inputSchema: {
      type: "object",
      required: ["milestoneId", "proof"],
      properties: {
        milestoneId: { type: "string" },
        proof: { type: "string", description: "Full proof report text with technical details, URLs, and metrics" },
        filename: { type: "string", description: "Filename for the proof document (default: proof-report.txt)" },
      },
    },
  },
  {
    name: "cascrow_verify",
    description:
      "Stream live AI verification results for a submitted proof. " +
      "5 AI models vote in parallel. Returns decision, confidence, action, and per-model votes.",
    inputSchema: {
      type: "object",
      required: ["proofId"],
      properties: {
        proofId: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_get_contract",
    description: "Get the current status and details of a contract, including all milestones.",
    inputSchema: {
      type: "object",
      required: ["contractId"],
      properties: {
        contractId: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_join_contract",
    description: "Join an existing contract as the Builder using an invite code.",
    inputSchema: {
      type: "object",
      required: ["inviteCode"],
      properties: {
        inviteCode: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_handoff",
    description: "Send a contract invite to a Builder agent by Agent ID.",
    inputSchema: {
      type: "object",
      required: ["inviteCode", "builderAgentId", "contractId"],
      properties: {
        inviteCode: { type: "string" },
        builderAgentId: { type: "string" },
        contractId: { type: "string" },
        message: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_get_agent_id",
    description: "Get this agent's own Agent ID.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cascrow_check_invites",
    description: "Check for pending contract invites sent to this agent.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cascrow_get_reputation",
    description: "Look up on-chain reputation of any agent by XRPL wallet address.",
    inputSchema: {
      type: "object",
      required: ["walletAddress"],
      properties: {
        walletAddress: { type: "string", description: "XRPL wallet address (e.g. rXXXX...)" },
      },
    },
  },
  {
    name: "cascrow_discover_agents",
    description: "Search for discoverable Builder agents by skill tags and success rate.",
    inputSchema: {
      type: "object",
      properties: {
        skill: { type: "string" },
        minRate: { type: "number", description: "0–1" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "cascrow_set_discoverable",
    description: "Configure this agent's discovery settings, skills, and callback URL.",
    inputSchema: {
      type: "object",
      properties: {
        discoverable: { type: "boolean" },
        skills: { type: "array", items: { type: "string" } },
        callbackUrl: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_list_my_contracts",
    description: "List all active cascrow contracts for this agent (as Requester or Builder).",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["requester", "builder"] },
      },
    },
  },
  {
    name: "cascrow_get_proof_status",
    description: "Check the AI verification result for a submitted proof.",
    inputSchema: {
      type: "object",
      required: ["proofId"],
      properties: {
        proofId: { type: "string" },
      },
    },
  },
  {
    name: "cascrow_mcp_submit",
    description:
      "Submit text-based proof and get an immediate verdict — all in one call. " +
      "Runs the full 5-model AI verification pipeline. Returns verdict, confidence, and on-chain proof URL.",
    inputSchema: {
      type: "object",
      required: ["contract_id", "evidence"],
      properties: {
        contract_id: { type: "string" },
        milestone_id: { type: "string" },
        evidence: {
          type: "object",
          required: ["description"],
          properties: {
            description: { type: "string" },
            links: { type: "array", items: { type: "string" } },
            github_commit: { type: "string" },
            revenue_amount: { type: "number" },
            custom_fields: { type: "object" },
          },
        },
      },
    },
  },
  {
    name: "cascrow_verify_work",
    description:
      "Verify AI-generated work without any escrow contract. " +
      "Provide a task description and either a GitHub PR URL or paste code/text. " +
      "Returns a public shareable report URL with a YES/NO decision, confidence score, " +
      "and per-model reasoning from 5 AI models. Use this to prove that AI work was actually done correctly.",
    inputSchema: {
      type: "object",
      required: ["taskDescription"],
      properties: {
        taskDescription: {
          type: "string",
          description: "What was the task? E.g. 'Fix the 3 security vulnerabilities listed in the audit report'",
        },
        prUrl: {
          type: "string",
          description: "GitHub PR URL (e.g. github.com/owner/repo/pull/42). Takes precedence over codeText.",
        },
        codeText: {
          type: "string",
          description: "Paste code, diff, or work description (max 50,000 chars). Used if no prUrl.",
        },
        checklistItems: {
          type: "array",
          description: "Optional list of specific items to verify individually",
          items: {
            type: "object",
            required: ["id", "title"],
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] },
            },
          },
        },
      },
    },
  },
];

// ─── Per-request server factory ───────────────────────────────────────────────

function buildServer(baseUrl: string, apiKey: string) {
  const { apiPost, apiGet, apiPatch } = makeHelpers(baseUrl, apiKey);

  // ── handlers ────────────────────────────────────────────────────────────────

  async function handleCreateContract({ milestones }: { milestones: { title: string; deadlineDays?: number; amountUSD?: number }[] }) {
    const deadline = (days: number | undefined) => {
      const d = new Date();
      d.setDate(d.getDate() + (days ?? 7));
      return d.toISOString();
    };
    const data = await apiPost("/api/contracts", {
      milestones: milestones.map((m) => ({
        title: m.title,
        amountUSD: m.amountUSD ?? 0,
        cancelAfter: deadline(m.deadlineDays),
      })),
    }) as { contractId: string; inviteLink?: string };
    const inviteCode = data.inviteLink ?? null;
    const contractUrl = `${baseUrl}/contract/${data.contractId}`;
    return { contractId: data.contractId, inviteCode, inviteLink: inviteCode, contractUrl, milestoneCount: milestones.length, message: `Contract created with ${milestones.length} milestone(s). View it here: ${contractUrl}` };
  }

  async function handleFundMilestone({ contractId, milestoneId }: { contractId: string; milestoneId?: string }) {
    const body = milestoneId ? { contractId, milestoneId } : { contractId };
    const data = await apiPost("/api/agent/fund-milestone", body) as { milestoneId: string; contractId: string; status: string };
    return { milestoneId: data.milestoneId, contractId: data.contractId, status: data.status, message: "Milestone funded and active. Ready to receive proof." };
  }

  async function handleEscrowFund({ contractId, agentPrivateKey, amountUSD, milestoneId }: { contractId: string; agentPrivateKey: string; amountUSD: number; milestoneId?: string }) {
    const data = await apiPost("/api/agent/escrow-fund", { contractId, agentPrivateKey, amountUSD, milestoneId }) as { milestoneId: string; contractId: string; txHash: string; amountUSD: number; status: string };
    return { milestoneId: data.milestoneId, contractId: data.contractId, txHash: data.txHash, amountUSD: data.amountUSD, status: data.status, message: `✅ Real escrow funded on-chain. ${data.amountUSD} RLUSD locked in smart contract. TX: ${data.txHash}` };
  }

  async function handleSubmitProof({ milestoneId, proof, filename }: { milestoneId: string; proof: string; filename?: string }) {
    const blob = new Blob([proof], { type: "text/plain" });
    const form = new FormData();
    form.append("file", blob, filename ?? "proof-report.txt");
    form.append("milestoneId", milestoneId);
    const res = await fetch(`${baseUrl}/api/proof/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const data = await res.json() as { error?: string; proofId?: string };
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return { proofId: data.proofId, message: `Proof submitted (proofId: ${data.proofId}). AI verification triggered. Call cascrow_verify with this proofId.` };
  }

  async function handleVerify({ proofId }: { proofId: string }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ proofId }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? `HTTP ${res.status}`);
    }
    type Vote = { type?: string; decision: string; confidence: number; model: string; reasoning?: string; message?: string; action?: string; txHash?: string };
    const votes: Vote[] = [];
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const msg = JSON.parse(raw) as Vote;
            if (msg.type === "model_vote") votes.push(msg);
            else if (msg.type === "complete") {
              const result = { ...msg, votes };
              const decision = result.decision ?? "?";
              const confidence = result.confidence ?? 0;
              const action = result.action ?? "?";
              const reasoning = (result as { reasoning?: string }).reasoning ?? "";
              const passed = action === "VERIFIED";
              const pendingReview = action === "PENDING_REVIEW";
              const TOTAL_MODELS = 5;
              const yesCount = votes.filter((v) => v.decision === "YES").length;
              const failedCount = TOTAL_MODELS - votes.length;
              const voteSummary = votes.map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`).join("\n");
              const failedNote = failedCount > 0 ? `\n  ⚠️ ${failedCount} model(s) failed` : "";
              const voteHeader = votes.length > 0 ? `${yesCount}/${TOTAL_MODELS} models approved:\n${voteSummary}${failedNote}\n\n` : "";
              const statusLine = passed ? `✅ VERIFIED (${confidence}% confidence)` : pendingReview ? `⏳ PENDING_REVIEW (${confidence}%) — manual review required.` : `❌ REJECTED (${confidence}%) — resubmit with stronger proof.`;
              return { decision, confidence, action, passed, pendingReview, reasoning, totalModels: TOTAL_MODELS, modelsResponded: votes.length, modelsFailed: failedCount, txHash: (result as { txHash?: string }).txHash ?? null, modelVotes: votes.map((v) => ({ model: v.model, decision: v.decision, confidence: v.confidence })), message: `${statusLine}\n\n${voteHeader}${reasoning.slice(0, 400)}` };
            } else if (msg.type === "error") {
              throw new Error(msg.message ?? "Verification error");
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    throw new Error("Stream ended without a complete event");
  }

  async function handleGetContract({ contractId }: { contractId: string }) {
    return apiGet(`/api/contracts/${contractId}`);
  }

  async function handleJoinContract({ inviteCode }: { inviteCode: string }) {
    const data = await apiPost("/api/contracts/join", { inviteCode }) as { contractId: string };
    return { contractId: data.contractId, message: "Joined contract as Builder. Contract is now AWAITING_ESCROW." };
  }

  async function handleHandoff({ inviteCode, builderAgentId, contractId, message }: { inviteCode: string; builderAgentId: string; contractId: string; message?: string }) {
    const data = await apiPost("/api/agent/handoff", { inviteCode, builderAgentId, contractId, message }) as { handoffId: string };
    return { handoffId: data.handoffId, message: `Contract handed off to Agent ${builderAgentId}.` };
  }

  async function handleGetAgentId() {
    const data = await apiGet("/api/agent/me") as { agentId: string };
    return { agentId: data.agentId, message: `Your Agent ID is: ${data.agentId}. Share this with Requester agents.` };
  }

  async function handleCheckInvites() {
    const data = await apiGet("/api/agent/pending-invites") as { invites?: unknown[] };
    const invites = data.invites ?? [];
    if (invites.length === 0) return { invites: [], message: "No pending invites. Poll again in a few seconds." };
    return { invites, message: `Found ${invites.length} invite(s). Use cascrow_join_contract with the inviteCode.` };
  }

  async function handleGetReputation({ walletAddress }: { walletAddress: string }) {
    const data = await apiGet(`/api/agent/reputation/${encodeURIComponent(walletAddress)}`) as { stats: { successRate: number | null; milestonesCompleted: number; totalRlusdReleased: number }; milestones?: { title: string; amountUSD: number; proofs: Record<string, string> }[]; skills?: string[] };
    const { stats, milestones = [], skills = [] } = data;
    const successPct = stats.successRate !== null ? `${Math.round(stats.successRate * 100)}%` : "no data yet";
    const milestoneLines = milestones.slice(0, 5).map((m) => {
      const proofLinks = Object.entries(m.proofs).filter(([, hash]) => hash).map(([k, hash]) => `${k}: https://xrpscan.com/tx/${hash}`).join(", ");
      return `  - "${m.title}" ($${m.amountUSD} RLUSD)${proofLinks ? ` — ${proofLinks}` : ""}`;
    }).join("\n");
    return { ...data, message: [`Agent reputation for ${walletAddress}:`, `  Completed: ${stats.milestonesCompleted} milestones`, `  RLUSD released: $${stats.totalRlusdReleased}`, `  Success rate: ${successPct}`, skills.length > 0 ? `  Skills: ${skills.join(", ")}` : null, milestones.length > 0 ? `\nRecent milestones:\n${milestoneLines}` : null].filter(Boolean).join("\n") };
  }

  async function handleDiscoverAgents({ skill, minRate, limit }: { skill?: string; minRate?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (skill) params.set("skill", skill);
    if (minRate !== undefined) params.set("minRate", String(minRate));
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    const data = await apiGet(`/api/agent/discover${qs ? `?${qs}` : ""}`) as { agents?: { name?: string; agentId: string; stats: { successRate: number | null }; skills: string[] }[]; total?: number };
    const { agents = [], total } = data;
    if (agents.length === 0) return { agents: [], total: 0, message: "No discoverable agents found." };
    const lines = agents.map((a) => { const rate = a.stats.successRate !== null ? ` (${Math.round(a.stats.successRate * 100)}% success)` : ""; const sk = a.skills.length > 0 ? ` — skills: ${a.skills.join(", ")}` : ""; return `  - ${a.name ?? a.agentId} [agentId: ${a.agentId}]${rate}${sk}`; }).join("\n");
    return { ...data, message: `Found ${total} agent(s):\n${lines}\n\nUse cascrow_handoff with the agentId.` };
  }

  async function handleSetDiscoverable({ discoverable, skills, callbackUrl }: { discoverable?: boolean; skills?: string[]; callbackUrl?: string } = {}) {
    const body: Record<string, unknown> = {};
    if (discoverable !== undefined) body.discoverable = discoverable;
    if (skills !== undefined) body.skills = skills;
    if (callbackUrl !== undefined) body.callbackUrl = callbackUrl;
    const data = await apiPatch("/api/agent/settings", body) as { discoverable?: boolean; skills?: string[]; callbackUrl?: string; profileUrl?: string };
    const parts: string[] = [];
    if (data.discoverable !== undefined) parts.push(`Discoverable: ${data.discoverable ? "✅ yes" : "❌ no"}`);
    if (data.skills?.length) parts.push(`Skills: ${data.skills.join(", ")}`);
    if (data.callbackUrl) parts.push(`Callback URL: ${data.callbackUrl}`);
    if (data.profileUrl) parts.push(`Public profile: ${baseUrl}${data.profileUrl}`);
    return { ...data, message: parts.length > 0 ? `Agent settings updated:\n${parts.map((p) => `  ${p}`).join("\n")}` : "Settings saved." };
  }

  async function handleListMyContracts({ role }: { role?: "requester" | "builder" } = {}) {
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    const data = await apiGet(`/api/agent/my-contracts${qs}`) as { contracts?: { contractId: string; status: string; role: string; milestones: { title: string; status: string }[] }[]; total?: number };
    const contracts = data.contracts ?? [];
    if (contracts.length === 0) return { contracts: [], total: 0, message: "No active contracts. Create one with cascrow_create_contract or check cascrow_check_invites." };
    const lines = contracts.map((c) => { const roleLabel = c.role === "requester" ? "Requester" : "Builder"; const activeMilestone = c.milestones.find((m) => ["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(m.status)) ?? c.milestones[0]; const msLine = activeMilestone ? ` — milestone: "${activeMilestone.title}" [${activeMilestone.status}]` : ""; return `  - ${c.contractId} [${c.status}] (${roleLabel})${msLine}`; }).join("\n");
    return { ...data, message: `Found ${data.total} contract(s):\n${lines}` };
  }

  async function handleGetProofStatus({ proofId }: { proofId: string }) {
    const data = await apiGet(`/api/agent/proof-status/${encodeURIComponent(proofId)}`) as { pending?: boolean; decision?: string; confidence?: number | null; contractStatus?: string; milestoneTitle?: string; milestoneStatus?: string; reasoning?: string };
    if (data.pending) return { ...data, message: `Proof ${proofId} is still being processed. Poll again in a few seconds.` };
    const decision = data.decision === "YES" ? "✅ APPROVED" : "❌ REJECTED";
    const conf = data.confidence != null ? ` (confidence: ${data.confidence}%)` : "";
    const parts = [`Proof ${proofId}: ${decision}${conf}`, `Contract status: ${data.contractStatus}`, data.milestoneTitle ? `Milestone: "${data.milestoneTitle}" [${data.milestoneStatus}]` : null, data.reasoning ? `Reasoning: ${data.reasoning.slice(0, 200)}${data.reasoning.length > 200 ? "…" : ""}` : null].filter(Boolean);
    return { ...data, message: parts.join("\n") };
  }

  async function handleMcpSubmit({ contract_id, milestone_id, evidence }: { contract_id: string; milestone_id?: string; evidence: { description: string; links?: string[]; github_commit?: string; revenue_amount?: number; custom_fields?: Record<string, unknown> } }) {
    const data = await apiPost("/api/mcp/submit", { contract_id, milestone_id, evidence }) as { verdict?: string; confidence?: number; on_chain_url?: string; proof_id?: string; signed_at?: string; reasoning?: string; model_votes?: { model: string; decision: string; confidence: number }[] };
    const verdict = data.verdict ?? "unknown";
    const confidence = data.confidence ?? 0;
    const onChainUrl = data.on_chain_url ?? null;
    const statusLine = verdict === "approved" ? `✅ APPROVED (${confidence}% confidence)${onChainUrl ? ` — proof: ${onChainUrl}` : ""}` : verdict === "pending_review" ? `⏳ PENDING_REVIEW (${confidence}%) — manual review triggered.` : `❌ REJECTED (${confidence}%) — resubmit with stronger evidence.`;
    const votes = Array.isArray(data.model_votes) ? data.model_votes : [];
    const voteSummary = votes.map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`).join("\n");
    return { verdict, confidence, reasoning: data.reasoning ?? "", model_votes: votes, on_chain_url: onChainUrl, proof_id: data.proof_id ?? null, signed_at: data.signed_at ?? null, message: `${statusLine}${voteSummary ? `\n\n${voteSummary}` : ""}${data.reasoning ? `\n\n${data.reasoning.slice(0, 400)}` : ""}` };
  }

  async function handleVerifyWork({ taskDescription, prUrl, codeText, checklistItems }: { taskDescription: string; prUrl?: string; codeText?: string; checklistItems?: { id: number; title: string; severity?: string }[] }) {
    if (!prUrl && !codeText) throw new Error("Provide either prUrl or codeText.");
    const data = await apiPost("/api/verify/standalone", { taskDescription, prUrl, codeText, checklistItems }) as { publicHash?: string; reportUrl?: string; decision?: string; confidence?: number; reasoning?: string; modelVotes?: { model: string; decision: string; confidence: number }[]; checklistResults?: { fixedCount: number; totalCount: number } };
    const decision = data.decision === "YES" ? "✅ VERIFIED" : "❌ NOT VERIFIED";
    const conf = data.confidence != null ? ` (${data.confidence}% confidence)` : "";
    const checklistNote = data.checklistResults ? ` — ${data.checklistResults.fixedCount}/${data.checklistResults.totalCount} checklist items addressed` : "";
    return { ...data, message: `${decision}${conf}${checklistNote}\n\nFull report: ${data.reportUrl ?? ""}${data.reasoning ? `\n\n${data.reasoning.slice(0, 400)}` : ""}` };
  }

  // ── Server ───────────────────────────────────────────────────────────────────

  const server = new Server(
    { name: "cascrow", version: "1.5.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      let result: unknown;
      switch (name) {
        case "cascrow_create_contract":   result = await handleCreateContract(args as Parameters<typeof handleCreateContract>[0]); break;
        case "cascrow_fund_milestone":    result = await handleFundMilestone(args as Parameters<typeof handleFundMilestone>[0]); break;
        case "cascrow_escrow_fund":       result = await handleEscrowFund(args as Parameters<typeof handleEscrowFund>[0]); break;
        case "cascrow_submit_proof":      result = await handleSubmitProof(args as Parameters<typeof handleSubmitProof>[0]); break;
        case "cascrow_verify":            result = await handleVerify(args as Parameters<typeof handleVerify>[0]); break;
        case "cascrow_get_contract":      result = await handleGetContract(args as Parameters<typeof handleGetContract>[0]); break;
        case "cascrow_join_contract":     result = await handleJoinContract(args as Parameters<typeof handleJoinContract>[0]); break;
        case "cascrow_handoff":           result = await handleHandoff(args as Parameters<typeof handleHandoff>[0]); break;
        case "cascrow_get_agent_id":      result = await handleGetAgentId(); break;
        case "cascrow_check_invites":     result = await handleCheckInvites(); break;
        case "cascrow_get_reputation":    result = await handleGetReputation(args as Parameters<typeof handleGetReputation>[0]); break;
        case "cascrow_discover_agents":   result = await handleDiscoverAgents(args as Parameters<typeof handleDiscoverAgents>[0]); break;
        case "cascrow_set_discoverable":  result = await handleSetDiscoverable(args as Parameters<typeof handleSetDiscoverable>[0]); break;
        case "cascrow_list_my_contracts": result = await handleListMyContracts(args as Parameters<typeof handleListMyContracts>[0]); break;
        case "cascrow_get_proof_status":  result = await handleGetProofStatus(args as Parameters<typeof handleGetProofStatus>[0]); break;
        case "cascrow_mcp_submit":        result = await handleMcpSubmit(args as Parameters<typeof handleMcpSubmit>[0]); break;
        case "cascrow_verify_work":       result = await handleVerifyWork(args as Parameters<typeof handleVerifyWork>[0]); break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  });

  return server;
}

// ─── Route handler ────────────────────────────────────────────────────────────

async function handleMcp(request: NextRequest): Promise<Response> {
  // Auth
  const authHeader = request.headers.get("authorization");
  const keyCtx = await resolveApiKey(authHeader);
  if (!keyCtx) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limit per API key
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`mcp-http:${keyCtx.keyId}:${ip}`, 200, 60 * 1000))) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://cascrow.com";

  // Re-fetch the raw API key from the Authorization header to forward it to downstream API calls.
  // resolveApiKey() already validated it; we just need the raw string for Bearer forwarding.
  const rawApiKey = authHeader!.slice(7); // strip "Bearer "

  const server = buildServer(baseUrl, rawApiKey);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close().catch(() => {});
  }
}

export const POST = handleMcp;
export const GET = handleMcp;
export const DELETE = handleMcp;
