@AGENTS.md

# Cascrow — Project Context

## Product
Cascrow is AI-verified escrow for the agent economy. A Requester locks RLUSD in a smart contract on the XRPL EVM Sidechain. A Builder delivers work. Five AI models from five different companies (Claude, Gemini, GPT-4o-mini, Mistral, Qwen3 via Cerebras) vote in parallel — 3/5 majority required. The smart contract releases funds automatically on YES. No human approval in the loop.

**Two modes:**
- **Escrow mode** — RLUSD locked on-chain via MetaMask. Funds release on AI YES verdict.
- **Verification-only** — `amountUSD: 0`, no MetaMask, no blockchain tx. $0.10/verification. Full AI pipeline still runs.

## MCP Server (`cascrow-mcp`)
Ships an MCP server giving Claude Desktop native tools to act as a Requester agent:
- `cascrow_create_contract` — create contract with milestones
- `cascrow_fund_milestone` — activate a milestone (instant for $0 contracts)
- `cascrow_submit_proof` — upload proof report
- `cascrow_verify` — trigger 5-model AI vote, returns result
- `cascrow_get_contract` — get contract status

Configured via `CASCROW_API_KEY` env var. Source in `cascrow-mcp/index.js`.

## Current Gap
Builder agents cannot join contracts via API key. The `/api/contracts/join` endpoint requires a browser session with `role === "STARTUP"`. This blocks agent-to-agent workflows where both Requester and Builder are AI agents.

The `/api/verify` endpoint streams SSE but all 5 model votes arrive together in the `complete` event — no per-vote streaming.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js App Router, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | NextAuth.js credentials — email/password, JWT |
| Escrow | XRPL EVM Sidechain (Chain ID 1449000), `MilestoneFundEscrow.sol` |
| Wallet | MetaMask (EIP-1193) — two-step: ERC-20 approve + fund |
| NFT + Audit | Native XRP Ledger Mainnet — NFTokenMint + AccountSet memos |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI | 5-model majority vote — Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Qwen3 |
| Rate limiting | Upstash Redis — INCR+PEXPIRE, cross-instance safe |
| File storage | Vercel Blob |
| Email | Resend (SMTP) |

## Key Files
- `src/app/api/contracts/join/route.ts` — contract join endpoint (session-only currently)
- `src/app/api/verify/route.ts` — AI verification SSE stream
- `src/services/ai/verifier.service.ts` — 5-model vote logic, `Promise.all`, `combineResults()`
- `src/lib/api-key-auth.ts` — API key resolution (used by verify, proof upload, etc.)
- `src/lib/rate-limit.ts` — Upstash Redis rate limiter
- `cascrow-mcp/index.js` — MCP server tools and handlers

## Terminology
- **Requester** = the party creating and funding the contract (DB field: `investorId`)
- **Builder** = the party delivering work (DB field: `startupId`)
- Routes use `/dashboard/investor` and `/dashboard/startup` internally — these are legacy names

## Blockchain Architecture
- EVM Sidechain: escrow and money. MetaMask signs in browser.
- Native XRPL Mainnet: NFT certificates + audit trail. Always mainnet regardless of EVM chain.
- `IS_MAINNET` in `src/lib/config.ts` controls XRPL RPC and explorer links.
- No public explorer for XRPL EVM Testnet — EVM hashes shown as plain text only.

## Contract Status Flow
```
DRAFT → AWAITING_ESCROW → FUNDED → PROOF_SUBMITTED → VERIFIED → COMPLETED
                                                    → PENDING_REVIEW
                                                    → REJECTED
```

## Important Constraints
- MetaMask two-step: ERC-20 approve first, then fund. Two separate popups.
- XRPL audit writes silent-fail if wallet not funded — always check env var.
- Sequence conflicts on XRPL: two audit events within ~3s can collide. One retry with fresh sequence in `audit-xrpl.service.ts`.
- Rate limit keys use `{action}:{userId}` or `{action}:{userId}:{ip}` patterns.
- `checkRateLimit` is always async — always await it.
