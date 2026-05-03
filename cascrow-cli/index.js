#!/usr/bin/env node
/**
 * Cascrow CLI
 * Command-line interface for Cascrow — agentic escrow and verification.
 * Usage: cascrow <command> [options]
 */

const BASE_URL = process.env.CASCROW_BASE_URL ?? "https://cascrow.com";
const API_KEY  = process.env.CASCROW_API_KEY ?? "";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function apiPost(path, body, key = API_KEY) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function apiGet(path, key = API_KEY) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Authorization": `Bearer ${key}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function uploadProof(milestoneId, filename, content, key = API_KEY) {
  const blob = new Blob([content], { type: "text/plain" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("milestoneId", milestoneId);
  const res = await fetch(`${BASE_URL}/api/proof/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function streamVerify(proofId, key = API_KEY) {
  const res = await fetch(`${BASE_URL}/api/verify`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
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
          const icon = msg.decision === "YES" ? "✅" : "❌";
          process.stderr.write(`  ${icon} ${msg.model}: ${msg.decision} (${msg.confidence}%)\n`);
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

// ─── Output helpers ───────────────────────────────────────────────────────────

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function err(msg) {
  console.error(`\nError: ${msg}\n`);
  process.exit(1);
}

function usage() {
  console.log(`
Cascrow CLI — agentic escrow and verification

Usage:
  cascrow register --email <email> --password <pass> [--name <name>]
  cascrow create --title <title> --description <desc> [--days <n>]
  cascrow fund --contract <id> [--milestone <id>]
  cascrow submit --milestone <id> --proof <text> [--file <name>]
  cascrow verify --proof <id>
  cascrow get --contract <id>
  cascrow join --invite <code>

Environment:
  CASCROW_API_KEY    Your API key (required for most commands)
  CASCROW_BASE_URL   Override API base (default: https://cascrow.com)

Examples:
  # Register a new agent account (no human in the loop)
  cascrow register --email bot@example.com --password secret123

  # Full verification flow
  cascrow create --title "Homepage redesign" --description "Hero section with CTA button, responsive" --days 7
  cascrow fund --contract <contractId>
  cascrow submit --milestone <milestoneId> --proof "Built hero with Tailwind, deployed at https://..."
  cascrow verify --proof <proofId>
`);
  process.exit(0);
}

// ─── Argument parser ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdRegister(args) {
  if (!args.email) err("--email is required");
  if (!args.password) err("--password is required");

  const res = await fetch(`${BASE_URL}/api/agent/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      password: args.password,
      name: args.name,
      keyName: args["key-name"] ?? "cli",
    }),
  });
  const data = await res.json();
  if (!res.ok) err(data.error ?? `HTTP ${res.status}`);
  print(data);
  console.error("\nSet your API key:\n  export CASCROW_API_KEY=" + data.apiKey + "\n");
}

async function cmdCreate(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.title) err("--title is required");

  const deadlineDays = parseInt(args.days ?? "7", 10);
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + deadlineDays);

  const data = await apiPost("/api/contracts", {
    milestones: [{
      title: args.description ? `${args.title} — ${args.description}` : args.title,
      amountUSD: 0,
      cancelAfter: deadline.toISOString(),
    }],
  });

  const contractUrl = `${BASE_URL}/contract/${data.contractId}`;
  print({ ...data, contractUrl });
}

async function cmdFund(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");

  const body = args.milestone
    ? { contractId: args.contract, milestoneId: args.milestone }
    : { contractId: args.contract };

  const data = await apiPost("/api/agent/fund-milestone", body);
  print(data);
}

async function cmdSubmit(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.milestone) err("--milestone is required");
  if (!args.proof) err("--proof is required");

  const data = await uploadProof(
    args.milestone,
    args.file ?? "proof-report.txt",
    args.proof
  );
  print(data);
  console.error(`\nProof submitted. Run: cascrow verify --proof ${data.proofId}\n`);
}

async function cmdVerify(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.proof) err("--proof is required");

  console.error("\nRunning AI verification (5 models)...\n");
  const result = await streamVerify(args.proof);

  const passed = result.decision === "YES" && result.confidence >= 85;
  print({
    decision: result.decision,
    confidence: result.confidence,
    passed,
    action: result.action,
    reasoning: result.reasoning,
    modelVotes: (result.votes ?? []).map(v => ({
      model: v.model,
      decision: v.decision,
      confidence: v.confidence,
    })),
  });
}

async function cmdGet(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");
  const data = await apiGet(`/api/contracts/${args.contract}`);
  print(data);
}

async function cmdJoin(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.invite) err("--invite is required");
  const data = await apiPost("/api/contracts/join", { inviteCode: args.invite });
  print(data);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv;
const args = parseArgs(rest);

if (!command || command === "--help" || command === "help" || command === "-h") {
  usage();
}

try {
  switch (command) {
    case "register":    await cmdRegister(args); break;
    case "create":      await cmdCreate(args); break;
    case "fund":        await cmdFund(args); break;
    case "submit":      await cmdSubmit(args); break;
    case "verify":      await cmdVerify(args); break;
    case "get":         await cmdGet(args); break;
    case "join":        await cmdJoin(args); break;
    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
  }
} catch (e) {
  err(e.message);
}
