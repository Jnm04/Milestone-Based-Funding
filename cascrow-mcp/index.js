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

async function apiPatch(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
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

// Stream verify with 180s timeout to handle slow AI quorums
async function streamVerify(proofId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({ proofId }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  const votes = [];
  const reader = res.body.getReader();
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
          const msg = JSON.parse(raw);
          if (msg.type === "model_vote") {
            votes.push(msg);
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
  } finally {
    reader.cancel().catch(() => {});
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
            required: ["title", "deadlineDays"],
            properties: {
              title: {
                type: "string",
                description: "Milestone title including acceptance criteria, e.g. 'Hero section with CTA — must be responsive down to 320px, LCP < 2s'",
              },
              deadlineDays: {
                type: "number",
                description: "Days from now until deadline (e.g. 7)",
              },
              amountUSD: {
                type: "number",
                description: "Optional RLUSD amount to lock in escrow (e.g. 1.0). Omit or set to 0 for verification-only.",
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
      "The more specific and verifiable the proof, the higher the AI confidence score. " +
      "NOTE: After submitting, the backend automatically triggers AI verification. " +
      "You can call cascrow_verify afterwards to stream the live results.",
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
      "Stream live AI verification results for a submitted proof. " +
      "5 AI models vote in parallel (Claude, GPT-4o, Gemini, Mistral, Cerebras). " +
      "Returns decision, confidence score, action (VERIFIED/PENDING_REVIEW/REJECTED), and per-model votes. " +
      "Call this after cascrow_submit_proof to get live results. " +
      "Confidence > 85 + YES = VERIFIED. Confidence 60–85 = PENDING_REVIEW (manual review needed). Confidence < 60 = REJECTED.",
    inputSchema: {
      type: "object",
      required: ["proofId"],
      properties: {
        proofId: { type: "string", description: "The proof ID returned by cascrow_submit_proof" },
      },
    },
  },
  {
    name: "cascrow_get_contract",
    description: "Get the current status and details of a contract, including all milestones and their statuses.",
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
  {
    name: "cascrow_get_reputation",
    description:
      "Look up the on-chain reputation of any agent by their XRPL wallet address. " +
      "Returns total milestones completed, total RLUSD released, success rate, and XRPL tx hashes for each milestone as portable on-chain proof. " +
      "No authentication required — public endpoint.",
    inputSchema: {
      type: "object",
      required: ["walletAddress"],
      properties: {
        walletAddress: {
          type: "string",
          description: "The XRPL wallet address of the agent (e.g. rXXXX...)",
        },
      },
    },
  },
  {
    name: "cascrow_discover_agents",
    description:
      "Search for discoverable Builder agents. " +
      "Filter by skill tags and minimum success rate to find the best agent for your task. " +
      "Returns agent IDs, wallet addresses, skill lists, and reputation stats. " +
      "Use this before cascrow_handoff to identify which builder agent to assign work to.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Filter by skill tag, e.g. 'python', 'solidity', 'data-analysis'",
        },
        minRate: {
          type: "number",
          description: "Minimum success rate between 0 and 1, e.g. 0.8 for 80%",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "cascrow_set_discoverable",
    description:
      "Configure this agent's discovery settings: opt in/out of the agent marketplace, " +
      "set skill tags so Requester agents can find you, and register a callback URL to receive " +
      "real-time events instead of polling (handoff received, milestone funded, verified, rejected). " +
      "Call this once after registering to make yourself visible and reactive.",
    inputSchema: {
      type: "object",
      properties: {
        discoverable: {
          type: "boolean",
          description: "Set to true to appear in cascrow_discover_agents searches",
        },
        skills: {
          type: "array",
          items: { type: "string" },
          description: "List of skill tags, e.g. ['python', 'solidity', 'data-analysis']",
        },
        callbackUrl: {
          type: "string",
          description: "HTTPS URL to receive real-time event notifications (POST). Set to null to disable.",
        },
      },
    },
  },
  {
    name: "cascrow_list_my_contracts",
    description:
      "List all active cascrow contracts for this agent — both as Requester (you created the contract) " +
      "and as Builder (you were hired). Returns contract IDs, statuses, and milestone details. " +
      "Use this after a restart to rediscover in-flight work, or to poll overall state without " +
      "knowing specific contract IDs. Filter by role='requester' or role='builder' if needed.",
    inputSchema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          enum: ["requester", "builder"],
          description: "Optional: 'requester' to see contracts you created, 'builder' to see contracts you joined. Omit to see both.",
        },
      },
    },
  },
  {
    name: "cascrow_get_proof_status",
    description:
      "Check the AI verification result for a submitted proof. Returns the decision (YES/NO), " +
      "confidence score, reasoning, and current milestone/contract status. " +
      "Use this to poll after cascrow_submit_proof or cascrow_mcp_submit — if pending=true, " +
      "the AI is still processing; poll again in a few seconds.",
    inputSchema: {
      type: "object",
      required: ["proofId"],
      properties: {
        proofId: {
          type: "string",
          description: "The proof ID returned by cascrow_submit_proof or cascrow_mcp_submit",
        },
      },
    },
  },
  {
    name: "cascrow_mcp_submit",
    description:
      "Submit text-based proof and get an immediate verdict — all in one call. " +
      "Runs the full 5-model AI verification pipeline and, on approval, automatically releases funds on-chain and mints an NFT certificate. " +
      "Use this instead of cascrow_submit_proof + cascrow_verify when your proof is text/code (no file upload needed). " +
      "Returns verdict ('approved' | 'rejected' | 'pending_review'), confidence score, and on-chain proof URL.",
    inputSchema: {
      type: "object",
      required: ["contract_id", "evidence"],
      properties: {
        contract_id: { type: "string", description: "The contract ID" },
        milestone_id: { type: "string", description: "Optional specific milestone ID. If omitted, targets the first active milestone." },
        evidence: {
          type: "object",
          required: ["description"],
          description: "Proof of milestone completion",
          properties: {
            description: {
              type: "string",
              description: "Full description of what was completed. Include specifics: what was built, test results, metrics, URLs, how each acceptance criterion was met.",
            },
            links: {
              type: "array",
              items: { type: "string" },
              description: "Optional URLs (live demo, GitHub PR, deployed app, etc.)",
            },
            github_commit: {
              type: "string",
              description: "Optional Git commit SHA or PR URL",
            },
            revenue_amount: {
              type: "number",
              description: "Optional revenue figure in USD (for revenue milestones)",
            },
            custom_fields: {
              type: "object",
              description: "Optional key-value pairs for additional context",
            },
          },
        },
      },
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleCreateContract({ milestones }) {
  const deadline = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + (days ?? 7));
    return d.toISOString();
  };

  const payload = {
    milestones: milestones.map((m) => ({
      title: m.title,
      amountUSD: m.amountUSD ?? 0,
      cancelAfter: deadline(m.deadlineDays),
    })),
  };

  const data = await apiPost("/api/contracts", payload);
  const contractUrl = `${BASE_URL}/contract/${data.contractId}`;

  // API returns inviteLink — expose as both keys so callers can use either
  const inviteCode = data.inviteLink ?? null;

  return {
    contractId: data.contractId,
    inviteCode,
    inviteLink: inviteCode,
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
    message: `Proof submitted (proofId: ${data.proofId}). AI verification has been triggered automatically. Call cascrow_verify with this proofId to stream the live results.`,
  };
}

async function handleVerify({ proofId }) {
  const result = await streamVerify(proofId);
  const decision   = result.decision ?? "?";
  const confidence = result.confidence ?? 0;
  const action     = result.action ?? "?";
  const reasoning  = result.reasoning ?? "";
  const votes      = result.votes ?? [];

  // Mirror backend three-tier logic exactly:
  // > 85 + YES = VERIFIED, 60–85 = PENDING_REVIEW, < 60 = REJECTED
  const passed = action === "VERIFIED";
  const pendingReview = action === "PENDING_REVIEW";

  const TOTAL_MODELS = 5;
  const yesCount = votes.filter((v) => v.decision === "YES").length;
  const failedCount = TOTAL_MODELS - votes.length;

  const voteSummary = votes
    .map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`)
    .join("\n");
  const failedNote = failedCount > 0 ? `\n  ⚠️ ${failedCount} model(s) failed to respond` : "";
  const voteHeader = votes.length > 0
    ? `${yesCount}/${TOTAL_MODELS} models approved:\n${voteSummary}${failedNote}\n\n`
    : "";

  let statusLine;
  if (passed) {
    statusLine = `✅ VERIFIED (${confidence}% confidence)`;
  } else if (pendingReview) {
    statusLine = `⏳ PENDING_REVIEW (${confidence}% confidence) — manual review required. Resubmit stronger proof or contact hello@cascrow.com.`;
  } else {
    statusLine = `❌ REJECTED (${confidence}% confidence) — resubmit with stronger proof.`;
  }

  return {
    decision,
    confidence,
    action,
    passed,
    pendingReview,
    reasoning,
    totalModels: TOTAL_MODELS,
    modelsResponded: votes.length,
    modelsFailed: failedCount,
    txHash: result.txHash ?? null,
    modelVotes: votes.map((v) => ({ model: v.model, decision: v.decision, confidence: v.confidence })),
    message: `${statusLine}\n\n${voteHeader}${reasoning.slice(0, 400)}`,
  };
}

async function handleGetContract({ contractId }) {
  const data = await apiGet(`/api/contracts/${contractId}`);
  return data;
}

async function handleJoinContract({ inviteCode }) {
  const data = await apiPost("/api/contracts/join", { inviteCode });
  return {
    contractId: data.contractId,
    message: `Joined contract as Builder. Contract is now AWAITING_ESCROW — ready to receive proof once funded.`,
  };
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

async function handleGetReputation({ walletAddress }) {
  const data = await apiGet(`/api/agent/reputation/${encodeURIComponent(walletAddress)}`);

  const { stats, milestones = [], skills = [] } = data;
  const successPct = stats.successRate !== null
    ? `${Math.round(stats.successRate * 100)}%`
    : "no data yet";

  const milestoneLines = milestones.slice(0, 5).map((m) => {
    const proofLinks = Object.entries(m.proofs)
      .filter(([, hash]) => hash)
      .map(([k, hash]) => `${k}: https://xrpscan.com/tx/${hash}`)
      .join(", ");
    return `  - "${m.title}" ($${m.amountUSD} RLUSD)${proofLinks ? ` — ${proofLinks}` : ""}`;
  }).join("\n");

  return {
    ...data,
    message: [
      `Agent reputation for ${walletAddress}:`,
      `  Completed: ${stats.milestonesCompleted} milestones`,
      `  RLUSD released: $${stats.totalRlusdReleased}`,
      `  Success rate: ${successPct}`,
      skills.length > 0 ? `  Skills: ${skills.join(", ")}` : null,
      milestones.length > 0 ? `\nRecent milestones:\n${milestoneLines}` : null,
    ].filter(Boolean).join("\n"),
  };
}

async function handleDiscoverAgents({ skill, minRate, limit } = {}) {
  const params = new URLSearchParams();
  if (skill)   params.set("skill",   skill);
  if (minRate !== undefined) params.set("minRate", String(minRate));
  if (limit)   params.set("limit",   String(limit));

  const qs = params.toString();
  const data = await apiGet(`/api/agent/discover${qs ? `?${qs}` : ""}`);

  const { agents = [], total } = data;
  if (agents.length === 0) {
    return { agents: [], total: 0, message: "No discoverable agents found matching your criteria." };
  }

  const lines = agents.map((a) => {
    const rate = a.stats.successRate !== null
      ? ` (${Math.round(a.stats.successRate * 100)}% success)`
      : "";
    const skills = a.skills.length > 0 ? ` — skills: ${a.skills.join(", ")}` : "";
    return `  - ${a.name ?? a.agentId} [agentId: ${a.agentId}]${rate}${skills}`;
  }).join("\n");

  return {
    ...data,
    message: `Found ${total} agent(s)${total > agents.length ? ` (showing ${agents.length})` : ""}:\n${lines}\n\nUse cascrow_handoff with the agentId to assign work.`,
  };
}

async function handleSetDiscoverable({ discoverable, skills, callbackUrl } = {}) {
  const body = {};
  if (discoverable !== undefined) body.discoverable = discoverable;
  if (skills       !== undefined) body.skills        = skills;
  if (callbackUrl  !== undefined) body.callbackUrl   = callbackUrl;

  const data = await apiPatch("/api/agent/settings", body);

  const parts = [];
  if (data.discoverable !== undefined)
    parts.push(`Discoverable: ${data.discoverable ? "✅ yes" : "❌ no"}`);
  if (data.skills?.length > 0)
    parts.push(`Skills: ${data.skills.join(", ")}`);
  if (data.callbackUrl)
    parts.push(`Callback URL: ${data.callbackUrl}`);
  if (data.profileUrl)
    parts.push(`Public profile: ${BASE_URL}${data.profileUrl}`);

  return {
    ...data,
    message: parts.length > 0
      ? `Agent settings updated:\n${parts.map((p) => `  ${p}`).join("\n")}`
      : "Settings saved.",
  };
}

async function handleListMyContracts({ role } = {}) {
  const qs = role ? `?role=${encodeURIComponent(role)}` : "";
  const data = await apiGet(`/api/agent/my-contracts${qs}`);
  const contracts = data.contracts ?? [];

  if (contracts.length === 0) {
    return { contracts: [], total: 0, message: "No active contracts found. Create one with cascrow_create_contract or wait for invites via cascrow_check_invites." };
  }

  const lines = contracts.map((c) => {
    const roleLabel = c.role === "requester" ? "Requester" : "Builder";
    const activeMilestone = c.milestones.find((m) => ["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(m.status))
      ?? c.milestones[0];
    const msLine = activeMilestone
      ? ` — milestone: "${activeMilestone.title}" [${activeMilestone.status}]`
      : "";
    return `  - ${c.contractId} [${c.status}] (${roleLabel})${msLine}`;
  }).join("\n");

  return {
    ...data,
    message: `Found ${data.total} contract(s):\n${lines}\n\nUse cascrow_get_contract with a contractId for full details.`,
  };
}

async function handleGetProofStatus({ proofId }) {
  const data = await apiGet(`/api/agent/proof-status/${encodeURIComponent(proofId)}`);

  if (data.pending) {
    return {
      ...data,
      message: `Proof ${proofId} is still being processed by the AI. Poll again in a few seconds.`,
    };
  }

  const decision = data.decision === "YES" ? "✅ APPROVED" : "❌ REJECTED";
  const conf = data.confidence !== null ? ` (confidence: ${data.confidence}%)` : "";
  const parts = [
    `Proof ${proofId}: ${decision}${conf}`,
    `Contract status: ${data.contractStatus}`,
    data.milestoneTitle ? `Milestone: "${data.milestoneTitle}" [${data.milestoneStatus}]` : null,
    data.reasoning ? `Reasoning: ${data.reasoning.slice(0, 200)}${data.reasoning.length > 200 ? "…" : ""}` : null,
  ].filter(Boolean);

  return {
    ...data,
    message: parts.join("\n"),
  };
}

async function handleMcpSubmit({ contract_id, milestone_id, evidence }) {
  const data = await apiPost("/api/mcp/submit", { contract_id, milestone_id, evidence });

  const verdict = data.verdict ?? "unknown";
  const confidence = data.confidence ?? 0;
  const onChainUrl = data.on_chain_url ?? null;
  const proofId = data.proof_id ?? null;

  let statusLine;
  if (verdict === "approved") {
    statusLine = `✅ APPROVED (${confidence}% confidence)${onChainUrl ? ` — proof: ${onChainUrl}` : ""}`;
  } else if (verdict === "pending_review") {
    statusLine = `⏳ PENDING_REVIEW (${confidence}% confidence) — manual review triggered.`;
  } else {
    statusLine = `❌ REJECTED (${confidence}% confidence) — resubmit with stronger evidence.`;
  }

  const votes = Array.isArray(data.model_votes) ? data.model_votes : [];
  const voteSummary = votes
    .map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`)
    .join("\n");

  return {
    verdict,
    confidence,
    reasoning: data.reasoning ?? "",
    model_votes: votes,
    on_chain_url: onChainUrl,
    proof_id: proofId,
    signed_at: data.signed_at ?? null,
    message: `${statusLine}${voteSummary ? `\n\n${voteSummary}` : ""}${data.reasoning ? `\n\n${data.reasoning.slice(0, 400)}` : ""}`,
  };
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "cascrow", version: "1.4.0" },
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
      case "cascrow_create_contract":  result = await handleCreateContract(args);  break;
      case "cascrow_fund_milestone":   result = await handleFundMilestone(args);   break;
      case "cascrow_escrow_fund":      result = await handleEscrowFund(args);      break;
      case "cascrow_submit_proof":     result = await handleSubmitProof(args);     break;
      case "cascrow_verify":           result = await handleVerify(args);          break;
      case "cascrow_get_contract":     result = await handleGetContract(args);     break;
      case "cascrow_join_contract":    result = await handleJoinContract(args);    break;
      case "cascrow_handoff":          result = await handleHandoff(args);         break;
      case "cascrow_check_invites":    result = await handleCheckInvites();              break;
      case "cascrow_get_agent_id":     result = await handleGetAgentId();               break;
      case "cascrow_get_reputation":   result = await handleGetReputation(args);        break;
      case "cascrow_discover_agents":  result = await handleDiscoverAgents(args);       break;
      case "cascrow_set_discoverable":  result = await handleSetDiscoverable(args);      break;
      case "cascrow_list_my_contracts": result = await handleListMyContracts(args);      break;
      case "cascrow_get_proof_status":  result = await handleGetProofStatus(args);       break;
      case "cascrow_mcp_submit":        result = await handleMcpSubmit(args);            break;
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
