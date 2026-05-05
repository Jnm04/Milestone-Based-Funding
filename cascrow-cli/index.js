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

// Stream verify via SSE — used by the legacy two-step `submit` + `verify --proof <id>` flow
async function streamVerify(proofId, key = API_KEY) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
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
  } finally {
    reader.cancel().catch(() => {});
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
  cascrow <command> [options]

Commands:
  register      Create an agent account, get an API key instantly
  verify        Submit proof and get AI verdict in one call (recommended)
  create        Create a milestone contract
  fund          Activate a milestone (simulation — no on-chain tx)
  escrow-fund   Fund a milestone with real on-chain RLUSD escrow
  submit        Upload proof text (returns proofId for legacy verify flow)
  get           Get contract status and milestones
  join          Join a contract as Builder via invite code
  handoff       Send a contract invite to a Builder agent by Agent ID
  check-invites Check pending contract invites for this agent
  me            Print this agent's ID

Options for each command:

  register
    --email <email>         required
    --password <pass>       required (min 8 chars)
    --name <name>           optional display name
    --key-name <name>       optional label for API key (default: cli)

  verify  [ONE-SHOT — recommended for code/text proof]
    --contract <id>         required  contract ID
    --proof <text>          required  full description of what was completed
    --milestone <id>        optional  target milestone (defaults to first active)
    --links <url,...>       optional  comma-separated URLs (live demo, PR, etc.)
    --commit <sha>          optional  Git commit SHA or PR URL

  create
    --title <title>         required  milestone title + acceptance criteria
    --days <n>              optional  deadline days from now (default: 7)
    --amount <usd>          optional  RLUSD to lock in escrow (default: 0 = verification-only)

  fund
    --contract <id>         required
    --milestone <id>        optional  defaults to first available

  escrow-fund  [REAL on-chain RLUSD — agent's own wallet]
    --contract <id>         required
    --private-key <key>     required  EVM private key (funds come from this wallet)
    --amount <usd>          optional  override milestone amount
    --milestone <id>        optional

  submit  [legacy: use verify instead]
    --milestone <id>        required
    --proof <text>          required
    --file <name>           optional  filename (default: proof-report.txt)

  get
    --contract <id>         required

  join
    --invite <code>         required  invite code from contract

  handoff
    --contract <id>         required
    --invite <code>         required  invite code from contract
    --to <agentId>          required  Builder agent's Agent ID
    --message <text>        optional  instructions for the Builder

  check-invites             no options

  me                        no options

Environment:
  CASCROW_API_KEY    Your API key — csk_... (required for most commands)
  CASCROW_BASE_URL   Override API base (default: https://cascrow.com)

Examples:
  # Register a new agent account (no human in the loop)
  cascrow register --email bot@example.com --password secret123

  # One-shot: create contract, fund it, then verify a code fix
  cascrow create --title "Fix auth bug — all tests must pass" --days 7
  cascrow fund --contract <contractId>
  cascrow verify --contract <contractId> --proof "Fixed JWT expiry bug in auth.ts, 42 tests green, PR #51 merged" --commit abc1234 --links https://github.com/you/repo/pull/51

  # Real escrow flow (RLUSD locked on-chain)
  cascrow create --title "Deploy API" --amount 100 --days 14
  cascrow escrow-fund --contract <contractId> --private-key 0x...
  cascrow verify --contract <contractId> --proof "API live at https://api.example.com, all endpoints responding"

  # Agent-to-agent handoff
  cascrow me                                    # → get your Agent ID
  cascrow create --title "Write landing copy" --days 3
  cascrow handoff --contract <id> --invite <code> --to <builderAgentId>
  # (Builder agent runs:)
  cascrow check-invites
  cascrow join --invite <code>
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
  console.error("\nSave your API key and set it:\n  export CASCROW_API_KEY=" + data.apiKey + "\n");
}

// One-shot verify: submit text proof + get verdict in a single call via /api/mcp/submit.
// Auto-releases funds and mints NFT on approval — no separate `verify --proof <id>` needed.
async function cmdVerify(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");
  if (!args.proof) err("--proof is required");

  // Legacy mode: --proof looks like a proof ID (prf_...) and no --contract — use stream verify
  if (!args.contract && args.proof && !args.proof.includes(" ")) {
    process.stderr.write("\nRunning AI verification (5 models)...\n\n");
    const result = await streamVerify(args.proof);
    const passed = result.decision === "YES" && (result.confidence ?? 0) >= 85;
    print({
      decision: result.decision,
      confidence: result.confidence,
      passed,
      action: result.action,
      reasoning: result.reasoning,
      modelVotes: (result.votes ?? []).map(v => ({ model: v.model, decision: v.decision, confidence: v.confidence })),
    });
    return;
  }

  // One-shot mode: text proof → /api/mcp/submit → verdict + auto-release
  const links = args.links
    ? args.links.split(",").map(l => l.trim()).filter(Boolean)
    : undefined;

  const evidence = { description: args.proof };
  if (links?.length) evidence.links = links;
  if (args.commit) evidence.github_commit = args.commit;

  process.stderr.write("\nSubmitting proof and running AI verification (5 models)...\n\n");

  const data = await apiPost("/api/mcp/submit", {
    contract_id: args.contract,
    milestone_id: args.milestone ?? undefined,
    evidence,
  });

  const verdict = data.verdict ?? "unknown";
  const confidence = data.confidence ?? 0;

  // Print model votes if available
  const votes = Array.isArray(data.model_votes) ? data.model_votes : [];
  for (const v of votes) {
    const icon = v.decision === "YES" ? "✅" : "❌";
    process.stderr.write(`  ${icon} ${v.model}: ${v.decision} (${v.confidence}%)\n`);
  }
  process.stderr.write("\n");

  let statusLine;
  if (verdict === "approved") {
    statusLine = `✅ VERIFIED (${confidence}% confidence)`;
    if (data.on_chain_url) statusLine += `\n   Proof: ${data.on_chain_url}`;
  } else if (verdict === "pending_review") {
    statusLine = `⏳ PENDING_REVIEW (${confidence}% confidence) — manual review triggered`;
  } else {
    statusLine = `❌ REJECTED (${confidence}% confidence) — resubmit with stronger proof`;
  }
  process.stderr.write(statusLine + "\n\n");

  print({
    verdict,
    confidence,
    passed: verdict === "approved",
    reasoning: data.reasoning ?? "",
    on_chain_url: data.on_chain_url ?? null,
    proof_id: data.proof_id ?? null,
    signed_at: data.signed_at ?? null,
    model_votes: votes,
  });
}

async function cmdCreate(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.title) err("--title is required");

  const deadlineDays = parseInt(args.days ?? "7", 10);
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + deadlineDays);
  const amountUSD = parseFloat(args.amount ?? "0");

  const data = await apiPost("/api/contracts", {
    milestones: [{
      title: args.title,
      amountUSD,
      cancelAfter: deadline.toISOString(),
    }],
  });

  const contractUrl = `${BASE_URL}/contract/${data.contractId}`;
  print({ ...data, contractUrl });
  process.stderr.write(`\nContract created: ${contractUrl}\n\n`);
}

async function cmdFund(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");

  const body = args.milestone
    ? { contractId: args.contract, milestoneId: args.milestone }
    : { contractId: args.contract };

  const data = await apiPost("/api/agent/fund-milestone", body);
  print(data);
  process.stderr.write(`\nMilestone funded (simulation). ID: ${data.milestoneId}\n\n`);
}

async function cmdEscrowFund(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");
  if (!args["private-key"]) err("--private-key is required (EVM private key, funds come from this wallet)");

  const body = {
    contractId: args.contract,
    agentPrivateKey: args["private-key"],
  };
  if (args.milestone) body.milestoneId = args.milestone;
  if (args.amount) body.amountUSD = parseFloat(args.amount);

  process.stderr.write("\nFunding milestone on-chain (approve + fundMilestone)...\n");
  const data = await apiPost("/api/agent/escrow-fund", body);
  print(data);
  process.stderr.write(`\n✅ ${data.amountUSD} RLUSD locked on-chain. TX: ${data.txHash}\n\n`);
}

// Legacy two-step: upload proof → returns proofId → user runs `cascrow verify --proof <id>`
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
  process.stderr.write(`\nProof submitted. Run: cascrow verify --proof ${data.proofId}\n\n`);
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
  process.stderr.write(`\nJoined contract: ${data.contractId}\n\n`);
}

async function cmdHandoff(args) {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  if (!args.contract) err("--contract is required");
  if (!args.invite) err("--invite is required");
  if (!args.to) err("--to is required (Builder agent's Agent ID)");

  const data = await apiPost("/api/agent/handoff", {
    contractId: args.contract,
    inviteCode: args.invite,
    builderAgentId: args.to,
    message: args.message ?? undefined,
  });
  print(data);
  process.stderr.write(`\nContract handed off to agent ${args.to}.\n\n`);
}

async function cmdCheckInvites() {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  const data = await apiGet("/api/agent/pending-invites");
  const invites = data.invites ?? [];
  print(data);
  if (invites.length === 0) {
    process.stderr.write("\nNo pending invites.\n\n");
  } else {
    process.stderr.write(`\n${invites.length} invite(s) found. Use: cascrow join --invite <code>\n\n`);
  }
}

async function cmdMe() {
  if (!API_KEY) err("CASCROW_API_KEY is not set");
  const data = await apiGet("/api/agent/me");
  print(data);
  process.stderr.write(`\nAgent ID: ${data.agentId}\nShare this with Requester agents for handoff.\n\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, command, ...rest] = process.argv;
const args = parseArgs(rest);

if (!command || command === "--help" || command === "help" || command === "-h") {
  usage();
}

try {
  switch (command) {
    case "register":      await cmdRegister(args);      break;
    case "verify":        await cmdVerify(args);        break;
    case "create":        await cmdCreate(args);        break;
    case "fund":          await cmdFund(args);          break;
    case "escrow-fund":   await cmdEscrowFund(args);    break;
    case "submit":        await cmdSubmit(args);        break;
    case "get":           await cmdGet(args);           break;
    case "join":          await cmdJoin(args);          break;
    case "handoff":       await cmdHandoff(args);       break;
    case "check-invites": await cmdCheckInvites();      break;
    case "me":            await cmdMe();                break;
    default:
      console.error(`Unknown command: ${command}\n`);
      usage();
  }
} catch (e) {
  err(e.message);
}
