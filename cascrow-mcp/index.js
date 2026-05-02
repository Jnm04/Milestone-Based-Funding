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

  const voteSummary = votes.length > 0
    ? votes.map((v) => `  ${v.decision === "YES" ? "✅" : "❌"} ${v.model}: ${v.decision} (${v.confidence}%)`).join("\n")
    : null;

  const yesCount = votes.filter((v) => v.decision === "YES").length;
  const voteHeader = votes.length > 0 ? `${yesCount}/${votes.length} models approved:\n${voteSummary}\n\n` : "";

  return {
    decision,
    confidence,
    action,
    reasoning,
    passed,
    txHash: result.txHash ?? null,
    modelVotes: votes.map((v) => ({ model: v.model, decision: v.decision, confidence: v.confidence })),
    message: passed
      ? `✅ VERIFIED (${confidence}% confidence)\n\n${voteHeader}${reasoning.slice(0, 300)}`
      : `❌ NOT VERIFIED (${confidence}% confidence)\n\n${voteHeader}${reasoning.slice(0, 300)}`,
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
