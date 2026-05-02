# YC Session Briefing — feature/agent-to-agent-verification

**Lies das durch bevor du die Session startest. Dann lösch diese Datei.**

---

## Setup

1. `cd /Users/user/milestonefund`
2. `git checkout feature/agent-to-agent-verification`
3. Neues Claude Code Fenster starten: `claude`
4. Diese Datei löschen bevor du anfängst: `rm YC_SESSION_BRIEFING.md`
5. Am Ende: `/export`

---

## Was auf diesem Branch fehlt (bewusst revertiert)

- `/api/contracts/join` akzeptiert nur Browser-Sessions, kein API Key Auth
- `verifyMilestone()` hat keinen `onVote` Callback — Votes kommen alle auf einmal
- MCP hat kein `cascrow_join_contract` Tool

Das baust du jetzt.

---

## Die 5 Prompts — exakt so tippen

---

### Prompt 1

```
I'm working on Cascrow — AI-verified escrow on the XRPL EVM Sidechain.
The product lets AI agents create milestone contracts, lock RLUSD, and
trigger a 5-model majority vote that releases funds automatically on-chain.

We have an MCP server that lets a Requester agent create and fund contracts.
But there's a gap: a Builder agent can't join a contract via API key.
The /api/contracts/join endpoint only accepts browser sessions with a
STARTUP role check. API key auth isn't supported.

Before implementing anything, read these three files so you understand
the current state:
- src/app/api/contracts/join/route.ts
- src/lib/api-key-auth.ts
- cascrow-mcp/index.js
```

---

### Prompt 2 — nachdem Claude die Files gelesen hat

```
Right. Three constraints for the fix:

1. Don't touch the existing session flow — role === "STARTUP" check stays
   for browser users
2. The wallet requirement should only apply when session users join escrow
   contracts (amountUSD > 0). API key agents don't use MetaMask — they either
   use verification-only mode or the platform handles release server-side
3. After the backend fix, add a cascrow_join_contract tool to the MCP server
   so a Builder agent can join with just an inviteCode

Implement all three.
```

---

### Prompt 3 — nachdem join implementiert ist

```
Good. Now the second problem: when cascrow_verify runs, the 5 AI models
execute in parallel via Promise.all but all votes arrive at once in the
complete SSE event. For users watching live — and especially for Claude
Desktop showing the MCP tool result — there's a 10-15 second silence
followed by a wall of results.

I want each model vote streamed as it arrives. Read verifier.service.ts
and the verify route first, then implement. The constraint: don't change
the parallel execution model or the combineResults() aggregation — the
fix should be purely additive.
```

---

### Prompt 4 — nachdem onVote implementiert ist

```
Before we wire this into the MCP server, I want to check the security
posture of the verification pipeline. Specifically:

1. The onVote callback receives model output — could a malicious proof
   document influence what gets sent through that callback?
2. How is the system prompt structured to prevent prompt injection from
   uploaded documents?

Read verifier.service.ts and tell me what's there before suggesting changes.
```

*(Lass Claude antworten — er wird die SECURITY INSTRUCTION und system/user
Trennung finden und erklären warum das solide ist. Das ist der stärkste
Moment der Session — du prüfst aktiv bevor du shipst.)*

---

### Prompt 5 — nach der Security-Analyse

```
Agreed, the prompt injection defense is solid. One gap though: the new
API key path on the join endpoint uses join-contract:userId:ip as the
rate limit key. But agents calling from serverless environments often
share IPs or have predictable IPs. Fix the rate limit key for API key
callers to use only userId, not ip.

Then update the MCP server to collect and display model votes as they
arrive from the SSE stream.

After that, run a TypeScript check and commit everything with a message
that explains why agent-to-agent matters for the product.
```

---

## Nach dem letzten Commit

```
/export
```

Speichere die Datei als `cascrow-agent-to-agent-session.md` — das ist
dein YC Upload.

---

## Was YC in dieser Session sieht

- Du verstehst deine eigene Architektur präzise genug um Constraints zu nennen
- Du prüfst Security aktiv bevor du eine neue Angriffsfläche shipst
- Du erkennst einen echten Rate-Limit-Edge-Case (serverless IPs)
- Die Features sind nicht trivial und direkt produktrelevant
- Du commitest mit Begründung, nicht nur mit Beschreibung
