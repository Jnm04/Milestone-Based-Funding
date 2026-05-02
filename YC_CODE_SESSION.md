# Cascrow — Claude Code Session
**Date:** May 2, 2026  
**Product:** Cascrow — AI-verified escrow for the agent economy  
**Stack:** Next.js, TypeScript, XRPL EVM Sidechain, Native XRP Ledger, PostgreSQL, Prisma, Upstash Redis

---

## Context

Cascrow locks RLUSD in a smart contract and releases funds only when a 5-model AI majority vote (Claude, Gemini, GPT-4o-mini, Mistral, Qwen3) confirms a milestone is complete. Post-Demo Day, preparing for YC application. This session covered four shipping decisions made in one day.

---

## Decision 1 — Taking Enterprise Offline Without Killing the Infrastructure

**The problem:** We built an enterprise tier (SSO, org audit logs, attestation mode, CSRD reporting). For YC we want to present one sharp product, not a confused two-tier story. But the infrastructure took weeks to build and we don't want to delete it.

**The question I asked:** How do you hide a feature from users without breaking anything underneath?

**What we did:**

```
src/app/(enterprise)/enterprise/page.tsx         → server-side redirect to /dashboard/investor
src/app/(enterprise)/enterprise/dashboard/page.tsx → server-side redirect to /dashboard/investor
src/app/login/page.tsx                           → removed isEnterprise redirect block
```

The entire enterprise API layer (`/api/enterprise/*`), database schema (`attestation`, `orgMember`, `auditLog` tables), and services remain untouched. We just removed the doors. The infrastructure stays hot for the day we want to turn it back on.

**Why this mattered for architecture:** Next.js `redirect()` runs server-side before any client JS loads. No flash of the old UI, no client-side guard that can be bypassed, no code to maintain. One function call per route.

---

## Decision 2 — Restructuring the Security Page to Tell a Product Story

**The problem:** The security page had an "Enterprise" section and a "All Users" section. With enterprise offline, it looked broken. But more importantly — API keys, webhook signing, and sanctions screening were listed as enterprise features even though they're available to everyone.

**The insight:** The security page is a sales document, not a feature list. Every feature on it should make a potential customer feel safer, not confused about what tier they're on.

**What we restructured:**

Before:
```
Section: All Users (basic auth, encryption)
Section: Enterprise (SSO, RBAC, API Keys, Webhooks, Sanctions, AI Verification)
```

After:
```
Section: Data & Privacy       (EU database, GDPR, AES-256, TLS, Vercel Blob, Sentry EU)
Section: Escrow & Blockchain  (non-custodial, cryptographic conditions, NFT certs, audit trail)
Section: Authentication       (bcrypt cost-12, rate limiting, email verification, sessions)
Section: API & Integrations   (API keys, webhook HMAC-SHA256 signing, sanctions screening)
Section: AI Verification      (5-model vote, prompt hash on-chain, proof file integrity)
```

Removed: enterprise badge system, legend, `SectionHead` variant props.

The result is a page that tells the complete security story in one pass — no tier confusion, no missing context.

---

## Decision 3 — Streaming Per-Model AI Votes Live to Clients

**The problem:** The `/api/verify` endpoint runs 5 AI models in parallel via `Promise.all` and returns a single `complete` SSE event at the end. The MCP server (`cascrow_verify` tool) just waited for that event and returned a single summary.

For the YC demo, the strongest visual moment is watching 5 models vote one by one. But the votes were invisible — they all arrived at once inside `combineResults()`.

**The architectural fix:**

Added `onVote` callback to `verifyMilestone` and `verifyMilestoneImage` in `verifier.service.ts`:

```typescript
// Each safeCall wraps with .then() — fires immediately when that model responds,
// not when all 5 are done
const withVoteCallback = (p: Promise<{ model: string; result: AIVerificationResult } | null>) =>
  p.then((r) => { 
    if (r && params.onVote) params.onVote({ 
      model: r.model, 
      decision: r.result.decision, 
      confidence: r.result.confidence, 
      reasoning: r.result.reasoning 
    }); 
    return r; 
  });

const raw = await Promise.all([
  withVoteCallback(safeCall(() => callClaude(...), "Claude")),
  withVoteCallback(safeCall(() => callGeminiText(...), "Gemini")),
  withVoteCallback(safeCall(() => callOpenAIText(...), "OpenAI")),
  withVoteCallback(safeCall(() => callMistralText(...), "Mistral")),
  withVoteCallback(safeCall(() => callCerebrasText(...), "Cerebras/Qwen3")),
]);
```

The route wires the callback into the SSE stream:

```typescript
const onVote = (vote: { model: string; decision: string; confidence: number }) => {
  send({ type: "model_vote", model: vote.model, decision: vote.decision, confidence: vote.confidence });
};

return verifyMilestone({ milestone, extractedText, enrichmentContext, verificationCriteria, onVote });
```

The MCP server collects these and writes each to stderr as it arrives:

```javascript
if (msg.type === "model_vote") {
  votes.push(msg);
  const icon = msg.decision === "YES" ? "✅" : "❌";
  process.stderr.write(`[cascrow] ${icon} ${msg.model}: ${msg.decision} (${msg.confidence}%)\n`);
}
```

**Why `.then()` on each `safeCall` instead of restructuring `Promise.all`:**  
`Promise.all` runs all 5 in parallel and we want to keep that. `.then()` attaches a side-effect callback to each individual promise without breaking the parallel execution or the final `combineResults()` aggregation. Zero change to the existing verification logic — the callback is purely additive.

**Result:** Claude Desktop now shows each model vote as it arrives, typically 1–3 seconds apart. The `cascrow_verify` result includes a full vote summary:

```
✅ VERIFIED (93% confidence)

5/5 models approved:
  ✅ Claude: YES (96%)
  ✅ Gemini: YES (91%)
  ✅ OpenAI: YES (94%)
  ✅ Mistral: YES (88%)
  ✅ Cerebras/Qwen3: YES (92%)

3/5 models confirmed the hero section criteria were met...
```

---

## Decision 4 — Implementing Real Agent-to-Agent Contracts

**The problem:** The `/api/contracts/join` endpoint required a browser session (`getServerSession`) and a STARTUP role. An AI agent using an API key could create contracts but could never *join* one as a builder. Agent-to-agent workflows were impossible.

**The three blockers we removed:**

1. **Session-only auth** — Added `resolveApiKey` fallback, same pattern used by `/api/verify` and `/api/proof/upload`

2. **Role check** — Session users still need `role === "STARTUP"`. API key agents are always treated as builders (they don't have roles, they have a user account with an API key)

3. **Wallet requirement** — The wallet check was unconditional. We scoped it: only required for escrow contracts via browser session. API key agents use verification-only mode (`amountUSD: 0`) or the platform handles on-chain release server-side

```typescript
// Before: blocked all API key agents
if (!session.user.walletAddress) {
  return NextResponse.json({ error: "Connect your XRPL wallet..." }, { status: 422 });
}

// After: only required when it actually matters
const isEscrow = contract.milestones.some((m) => Number(m.amountUSD) > 0);
if (session && isEscrow && !session.user.walletAddress) {
  return NextResponse.json({ error: "Connect your XRPL wallet..." }, { status: 422 });
}
```

**Added `cascrow_join_contract` MCP tool:**

```javascript
{
  name: "cascrow_join_contract",
  description: "Join an existing contract as the Builder. Use this when another agent 
    has created a contract and shared an invite code with you.",
  inputSchema: {
    type: "object",
    required: ["inviteCode"],
    properties: {
      inviteCode: { type: "string" }
    }
  }
}
```

**The full agent-to-agent flow now works end-to-end:**

```
Requester Agent (API Key A)
  → cascrow_create_contract   → returns { contractId, inviteCode }
  → [sends inviteCode to Builder Agent via any channel]

Builder Agent (API Key B)  
  → cascrow_join_contract({ inviteCode })  → joins as startup, contract → AWAITING_ESCROW

Requester Agent
  → cascrow_fund_milestone({ contractId }) → contract → FUNDED

Builder Agent
  → [does the work]
  → cascrow_submit_proof({ milestoneId, proof })
  → cascrow_verify({ proofId })            → 5-model vote → COMPLETED → funds released
```

Two different API keys. Two different user accounts. Zero human involvement. The smart contract enforces the release condition — neither agent can cheat.

---

## What This Session Demonstrates

**Speed:** Four independent features shipped and pushed in one session — security page restructure, enterprise soft-launch, live vote streaming, agent-to-agent contracts.

**Judgment over execution:** The most important decision wasn't writing code — it was recognizing that deleting the enterprise features would be a mistake. The right call was `redirect()`, not `rm`.

**Additive architecture:** The vote streaming change (`onVote` callback) added zero risk to the existing verification pipeline. The agent-to-agent change added zero risk to the existing browser auth flow. Both changes are purely additive — existing users see no difference.

**The product thesis in code:** Every decision in this session points at the same thing — Cascrow should be invisible infrastructure. Agents call five tools, work gets verified, money moves. The less a human has to touch it, the better we've done our job.
