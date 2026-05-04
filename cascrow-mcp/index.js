#!/usr/bin/env node
/**
 * Cascrow MCP Server
 * Gives Claude the ability to create contracts, fund milestones,
 * submit proofs, and verify deliverables — all via the Cascrow API.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = process.env.CASCROW_BASE_URL ?? "https://cascrow.com";
const API_KEY  = process.env.CASCROW_API_KEY ?? "";

if (!API_KEY) {
  process.stderr.write("ERROR: CASCROW_API_KEY is not set\n");
  process.exit(1);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Authorization": `Bearer ${API_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

async function uploadProof(milestoneId, filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("milestoneId", milestoneId);

  const res = await fetch(`${BASE_URL}/api/proof/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${API_KEY}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

async function streamVerify(proofId) {
  const res = await fetch(`${BASE_URL}/api/verify`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({ proofId }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  const votes = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        const msg = JSON.parse(raw);
        if (msg.type === "model_vote") {
          votes.push(msg);
          // Log each vote to stderr so Claude Desktop can show live progress
          const icon = msg.decision === "YES" ? "✅" : "❌";
          process.stderr.write(`[cascrow] ${icon} ${msg.model}: ${msg.decision} (${msg.confidence}%)\n`);
        } else if (msg.type === "complete") {
          return { ...msg, votes };
        } else if (msg.type === "error") {
          throw new Error(msg.message);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  throw new Error("Stream ended without a complete event");
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
            required: ["title", "description", "deadlineDays"],
            properties: {
              title: {
                type: "string",
                description: "Short milestone title, e.g. 'Hero section with CTA'",
              },
              description: {
                type: "string",
                description: "Detailed acceptance criteria — what exactly must be true for this milestone to pass AI verification",
              },
              deadlineDays: {
                type: "number",
                description: "Days from now until deadline (e.g. 7)",
              },
            },
          },
        },
      },
    },
  },
  {
    name: "cascrow_fund_milestone",
    description:
      "Fund (activate) a milestone so it can receive proof. " +
      "Call this after creating the contract and before submitting proof for a milestone.",
    inputSchema: {
      type: "object",
      required: ["contractId"],
      properties: {
        contractId: { type: "string", description: "The contract ID returned by cascrow_create_contract" },
        milestoneId: { type: "string", description: "Optional specific milestone ID. If omitted, funds the first available milestone." },
      },
    },
  },
  {
    name: "cascrow_escrow_fund",
    description:
      "Fund a milestone with REAL on-chain RLUSD escrow using the agent's own EVM private key. " +
      "This does a real approve + fundMilestone transaction on the XRPL EVM Sidechain — " +
      "funds are locked in the smart contract and released automatically after AI verification. " +
      "Use this instead of cascrow_fund_milestone when you want real escrow (not just verification).",
    inputSchema: {
      type: "object",
      required: ["contractId", "agentPrivateKey", "amountUSD"],
      properties: {
        contractId: { type: "string", description: "The contract ID to fund" },
        agentPrivateKey: { type: "string", description: "The agent's EVM private key (hex, 0x-prefixed). The agent's wallet must hold enough RLUSD." },
        amountUSD: { type: "number", description: "Amount in USD to lock in escrow (e.g. 1.0)" },
        milestoneId: { type: "string", description: "Optional specific milestone ID. If omitted, funds the first available milestone." },
      },
    },
  },
  {
    name: "cascrow_submit_proof",
    description:
      "Submit proof of completion for a milestone. " +
      "Write a detailed, specific proof report describing exactly what was built, " +
      "with verifiable evidence (URLs, metrics, specific implementation details). " +
      "The more specific and verifiable the proof, the higher the AI confidence score.",
    inputSchema: {
      type: "object",
      required: ["milestoneId", "proof"],
      properties: {
        milestoneId: { type: "string", description: "The milestone ID to submit proof for" },
        proof: {
          type: "string",
          description: "Full proof report text. Include: what was built, specific technical details, live URLs, metrics, and how each acceptance criterion was met.",
        },
        filename: {
          type: "string",
          description: "Filename for the proof document (default: proof-report.txt)",
        },
      },
    },
  },
  {
    name: "cascrow_verify",
    description:
      "Trigger AI verification for a submitted proof and wait for the result. " +
      "5 AI models vote in parallel (Claude, GPT-4o, Gemini, Mistral, Cerebras). " +
      "Returns decision (YES/NO), confidence score, reasoning, and action taken. " +
      "Call this after cascrow_submit_proof.",
    inputSchema: {
      type: "object",
      required: ["proofId"],
      properties: {
        proofId: { type: "string", description: "The proof ID returned by cascrow_submit_proof" },
      },
    },
  },
  {
    name: "cascrow_join_contract",
    description:
      "Join an existing contract as the Builder (the party that delivers the work). " +
      "Use this when another agent or user has created a contract and shared an invite code with you. " +
      "Once joined, the contract moves to AWAITING_ESCROW and you can receive proof submissions.",
    inputSchema: {
      type: "object",
      required: ["inviteCode"],
      properties: {
        inviteCode: {
          type: "string",
          description: "The invite code or invite link token shared by the Requester agent.",
        },
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
    name: "cascrow_handoff",
    description:
      "Send a contract invite to a Builder agent by Agent ID. " +
      "Use this after cascrow_create_contract to delegate the work to another agent. " +
      "The Builder agent will automatically pick up the invite via cascrow_check_invites.",
    inputSchema: {
      type: "object",
      required: ["inviteCode", "builderAgentId", "contractId"],
      properties: {
        inviteCode: { type: "string", description: "The invite code returned by cascrow_create_contract" },
        builderAgentId: { type: "string", description: "The Agent ID of the Builder agent (from cascrow_get_agent_id)" },
        contractId: { type: "string", description: "The contract ID returned by cascrow_create_contract" },
        message: { type: "string", description: "Optional instructions for the Builder agent" },
      },
    },
  },
  {
    name: "cascrow_get_agent_id",
    description: "Get this agent's own Agent ID. Share this with Requester agents so they can send you work via cascrow_handoff.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cascrow_check_invites",
    description:
      "Check for pending contract invites sent to this agent. " +
      "Use this as a Builder agent to discover work assigned to you. " +
      "Returns unclaimed invites and marks them as claimed. Poll every few seconds until an invite appears.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleCreateContract({ milestones }) {
  const deadline = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const payload = {
    milestones: milestones.map((m) => ({
      title: `${m.title} — ${m.description}`,
      amountUSD: 0, // verification-only — $0.10 charged per verification trigger
      cancelAfter: deadline(m.deadlineDays ?? 7),
    })),
  };

  const data = await apiPost("/api/contracts", payload);
  const contractUrl = `${BASE_URL}/contract/${data.contractId}`;

  return {
    contractId: data.contractId,
    inviteCode: data.inviteLink,
    contractUrl,
    milestoneCount: milestones.length,
    message: `Contract created with ${milestones.length} milestone(s). View it here: ${contractUrl}`,
  };
}

async function handleFundMilestone({ contractId, milestoneId }) {
  const body = milestoneId ? { contractId, milestoneId } : { contractId };
  const data = await apiPost("/api/agent/fund-milestone", body);
  return {
    milestoneId: data.milestoneId,
    contractId: data.contractId,
    status: data.status,
    message: `Milestone funded and active. Ready to receive proof.`,
  };
}

async function handleEscrowFund({ contractId, agentPrivateKey, amountUSD, milestoneId }) {
  const data = await apiPost("/api/agent/escrow-fund", { contractId, agentPrivateKey, amountUSD, milestoneId });
  return {
    milestoneId: data.milestoneId,
    contractId: data.contractId,
    txHash: data.txHash,
    amountUSD: data.amountUSD,
    status: data.status,
    message: `✅ Real escrow funded on-chain. ${data.amountUSD} RLUSD locked in smart contract. TX: ${data.txHash}`,
  };
}

async function handleSubmitProof({ milestoneId, proof, filename }) {
  const data = await uploadProof(
    milestoneId,
    filename ?? "proof-report.txt",
    proof
  );
  return {
    proofId: data.proofId,
    message: `Proof submitted. Use cascrow_verify with proofId: ${data.proofId}`,
  };
}

async function handleVerify({ proofId }) {
  const result = await streamVerify(proofId);
  const decision   = result.decision ?? "?";
  const confidence = result.confidence ?? 0;
  const action     = result.action ?? "?";
  const reasoning  = result.reasoning ?? "";
  const votes      = result.votes ?? [];

  const passed = decision === "YES" && confidence >= 85;

  const TOTAL_MODELS = 5;
  const yesCount = votes.filter((v) => v.decision === "YES").length;
  const failedCount = TOTAL_MODELS - votes.length;

  const voteSummary = votes
    .map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`)
    .join("\n");
  const failedNote = failedCount > 0 ? `\n  ⚠️ ${failedCount} model(s) failed to respond` : "";
  const voteHeader = votes.length > 0
    ? `${yesCount}/${TOTAL_MODELS} models approved (${failedCount > 0 ? `${failedCount} failed` : "all responded"}):\n${voteSummary}${failedNote}\n\n`
    : "";

  return {
    decision,
    confidence,
    action,
    reasoning,
    passed,
    totalModels: TOTAL_MODELS,
    modelsResponded: votes.length,
    modelsFailed: failedCount,
    txHash: result.txHash ?? null,
    modelVotes: votes.map((v) => ({ model: v.model, decision: v.decision, confidence: v.confidence })),
    message: passed
      ? `✅ VERIFIED — Cascrow consensus confidence: ${confidence}%\n\n${voteHeader}${reasoning.slice(0, 300)}`
      : `❌ NOT VERIFIED — Cascrow consensus confidence: ${confidence}%\n\n${voteHeader}${reasoning.slice(0, 300)}`,
  };
}

async function handleJoinContract({ inviteCode }) {
  const data = await apiPost("/api/contracts/join", { inviteCode });
  return {
    contractId: data.contractId,
    message: `Joined contract as Builder. Contract is now AWAITING_ESCROW — ready to receive proof once funded.`,
  };
}

async function handleGetContract({ contractId }) {
  const data = await apiGet(`/api/contracts/${contractId}`);
  return data;
}

async function handleHandoff({ inviteCode, builderAgentId, contractId, message }) {
  const data = await apiPost("/api/agent/handoff", { inviteCode, builderAgentId, contractId, message });
  return {
    handoffId: data.handoffId,
    message: `Contract handed off to Agent ${builderAgentId}. They will pick it up automatically via cascrow_check_invites.`,
  };
}

async function handleGetAgentId() {
  const data = await apiGet("/api/agent/me");
  return {
    agentId: data.agentId,
    message: `Your Agent ID is: ${data.agentId}. Share this with Requester agents so they can send you work.`,
  };
}

async function handleCheckInvites() {
  const data = await apiGet("/api/agent/pending-invites");
  const invites = data.invites ?? [];
  if (invites.length === 0) {
    return { invites: [], message: "No pending invites. Poll again in a few seconds." };
  }
  return {
    invites,
    message: `Found ${invites.length} invite(s). Use cascrow_join_contract with the inviteCode to accept.`,
  };
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "cascrow", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case "cascrow_create_contract":
        result = await handleCreateContract(args);
        break;
      case "cascrow_fund_milestone":
        result = await handleFundMilestone(args);
        break;
      case "cascrow_escrow_fund":
        result = await handleEscrowFund(args);
        break;
      case "cascrow_submit_proof":
        result = await handleSubmitProof(args);
        break;
      case "cascrow_verify":
        result = await handleVerify(args);
        break;
      case "cascrow_join_contract":
        result = await handleJoinContract(args);
        break;
      case "cascrow_get_contract":
        result = await handleGetContract(args);
        break;
      case "cascrow_handoff":
        result = await handleHandoff(args);
        break;
      case "cascrow_check_invites":
        result = await handleCheckInvites();
        break;
      case "cascrow_get_agent_id":
        result = await handleGetAgentId();
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
