# Cascrow

**Agentic escrow and verification for the AI era.**

Cascrow locks RLUSD in a smart contract and releases funds only when a 5-model AI majority vote confirms the milestone is met — secured by cryptographic proof on two independent blockchains.

Built at the **XRPL Student Builder Residency 2026** — post-Demo Day, moving toward real market launch.

---

## What Cascrow does

Every year, trillions of dollars change hands based on trust that something happened. Grants are disbursed on milestone reports no one reads. Dev contracts are paid when a manager approves a Slack message. The entire system runs on social trust — and social trust fails constantly.

Cascrow replaces that with verifiable finality:

- **Escrow mode** — RLUSD locked in a smart contract on the XRPL EVM Sidechain. Five independent AI models from five different companies must reach a 3/5 majority before a single token moves.
- **Verification-only mode** — No escrow required. AI agents create a contract, submit proof, and get a cryptographic verification record — no MetaMask, no blockchain transaction. $0.10 per verification.
- **Attestation mode** *(coming soon)* — Enterprise teams verify ESG, sustainability, and KPI commitments. Every verdict written to the XRP Ledger as a permanent, tamper-evident record.

---

## Cascrow MCP — for AI agents

Cascrow ships a [Model Context Protocol](https://modelcontextprotocol.io) server that gives Claude (or any MCP-compatible agent) native tools to create contracts, submit proof, and trigger verification — all autonomously.

### Setup

1. Get an API key from your Requester dashboard → **Deploy Agent**
2. Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cascrow": {
      "command": "npx",
      "args": ["cascrow-mcp"],
      "env": {
        "CASCROW_API_KEY": "csk_your_key_here"
      }
    }
  }
}
```

### Available tools

| Tool | What it does |
|---|---|
| `cascrow_create_contract` | Create a contract with one or more milestones |
| `cascrow_fund_milestone` | Activate a milestone (instant for $0 verification-only contracts) |
| `cascrow_submit_proof` | Upload a proof report for a milestone |
| `cascrow_verify` | Trigger 5-model AI verification, stream results |
| `cascrow_get_contract` | Get current contract status and milestone details |

### Example prompt for Claude Desktop

```
I need a landing page for my SaaS "TaskFlow". It needs:
1. Hero section: headline + CTA
2. Features section: 3 features

Use Cascrow to verify each milestone as I build it — create the
contract first, then for each section: build it, submit proof,
trigger AI verification. Show me the contract link and confidence
scores at the end.
```

Claude will call `cascrow_create_contract` (amountUSD: 0 — no MetaMask needed), build each section, submit proof, and stream back AI confidence scores. You get a `cascrow.com/contract/<id>` link showing milestones going PROOF_SUBMITTED → VERIFIED in real time.

---

## How Escrow mode works

```
Requester creates contract with milestone(s), amounts, deadlines
              ↓
Builder accepts via invite link
              ↓
Requester approves RLUSD + signs fundMilestone via MetaMask
  → RLUSD locked in smart contract; platform cannot redirect it
              ↓
Builder uploads PDF, image, or links a GitHub repo as proof
              ↓
5 AI models evaluate in parallel (Claude, Gemini, GPT-4o-mini, Mistral, Qwen3)
3/5 majority required
              ↓
  YES        → funds released automatically to builder
             → non-transferable NFT minted on native XRP Ledger
  UNCERTAIN  → requester reviews manually
             → builder can resubmit stronger proof at any time
             → 14 days no requester action → auto-release + NFT
  NO         → builder can resubmit until deadline
              ↓
  Deadline passed → cron cancels escrow, RLUSD returned to requester
```

Multi-milestone contracts are fully supported — each milestone has its own escrow, proof cycle, and NFT.

---

## Trustless by design

Neither party needs to trust the platform. Every critical guarantee is enforced on-chain.

### What the smart contract enforces

- **Funds go to one address only.** The builder's wallet is written into the escrow at funding time and cannot be changed.
- **Anyone with the fulfillment key can release.** `releaseMilestone` is callable by any address. When AI approves, the platform emails the fulfillment key to the builder. If Cascrow goes offline, the builder can execute on-chain directly with MetaMask.
- **The requester can cancel without us.** After deadline, `cancelMilestone` is callable directly by the requester.
- **The condition is locked on-chain.** `keccak256(fulfillment)` is stored at funding time. The platform cannot produce a different key later.

### What the audit trail proves

Every event is written to two independent chains before the platform responds:

| Event | What's locked on-chain |
|---|---|
| `ESCROW_FUNDED` | `keccak256(milestoneTitle)` — agreed criteria at the moment money was locked |
| `PROOF_SUBMITTED` | `sha256(file)` — the exact file the AI evaluated |
| `AI_DECISION` | 5-model verdict, per-model votes, confidence score, `sha256(system_prompt)` |
| `FUNDS_RELEASED` | On-chain RLUSD transaction hash |

### Remaining trust assumptions (transparent)

- **AI verdict** — 5 models from 5 different companies (Anthropic, Google, OpenAI, Mistral, Alibaba/Cerebras) must reach a 3/5 majority. The prompt hash is locked on-chain so changes are detectable.
- **PENDING_REVIEW** — when confidence is borderline, the requester decides. Auto-release after 14 days prevents indefinite blocking.
- **Proof storage** — files are in Vercel Blob. The SHA-256 hash is on-chain so tampering is detectable.

---

## NFT Completion Certificates

When a milestone is verified, Cascrow mints a **non-transferable `NFTokenMint`** on the native XRP Ledger mainnet. The certificate exists permanently on a public ledger independent of Cascrow's servers — verifiable by anyone with the contract ID.

Over time, a builder accumulates a collection of AI-verified, real-money-backed completion certificates — a verifiable on-chain track record.

---

## Enterprise features *(coming soon)*

Enterprise attestation is built and functional — not yet publicly available. Infrastructure includes ESG/KPI attestation, team management, audit firm access, Slack/Teams integrations, regulatory change alerts (CSRD/ESRS), confidential goals, and deal rooms.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| UI | Tailwind CSS — dark copper/amber design system |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js, EIP-1193) |
| Escrow | XRPL EVM Sidechain (Chain ID 1449000), Solidity `MilestoneFundEscrow` |
| NFT + Audit | Native XRP Ledger mainnet — `NFTokenMint` + `AccountSet` memos |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI verification | 5-model majority vote: Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Qwen3 via Cerebras |
| MCP server | `cascrow-mcp` — gives Claude native tools to use the full Cascrow API |
| Database | PostgreSQL + Prisma ORM |
| File storage | Vercel Blob |
| Rate limiting | Upstash Redis (INCR+PEXPIRE, cross-instance safe for serverless) |
| Email | Resend (via SMTP) |
| Notifications | Slack (OAuth), Microsoft Teams (webhook) |
| Error monitoring | Sentry (EU region, Frankfurt) |
| Bot protection | Cloudflare Turnstile |

---

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL
- API keys: Anthropic, Google Gemini, OpenAI, Mistral, Cerebras
- Vercel Blob token
- Upstash Redis (REST URL + token)
- Resend API key (optional)

### Install

```bash
npm install
```

### Environment variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# Encryption
ENCRYPTION_KEY=         # openssl rand -base64 32

# AI — 5-model verification
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
CEREBRAS_API_KEY=csk_...

# File storage
BLOB_READ_WRITE_TOKEN=  # Vercel Blob

# Rate limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# EVM escrow
NEXT_PUBLIC_EVM_RPC_URL=https://rpc.testnet.xrplevm.org
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS=0x...
EVM_PLATFORM_PRIVATE_KEY=0x...

# Native XRPL (NFT + audit memos) — mainnet by default
XRPL_PLATFORM_SEED=s...
# XRPL_NETWORK=testnet   # set to force testnet

# Email
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASS=re_...
EMAIL_FROM=Cascrow <noreply@cascrow.com>

# Slack integration (optional)
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...

# Bot protection
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=...
CLOUDFLARE_TURNSTILE_SECRET_KEY=...

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_ORG=...
SENTRY_PROJECT=...
SENTRY_AUTH_TOKEN=...

# Internal / cron
INTERNAL_API_SECRET=...
CRON_SECRET=...
```

> **XRPL wallet:** create a testnet wallet at [xrpl.org/xrp-testnet-faucet.html](https://xrpl.org/xrp-testnet-faucet.html), copy the seed to `XRPL_PLATFORM_SEED`. Needs ~10 XRP reserve.

### Database

```bash
npx prisma db push
npx prisma generate
```

### Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Deployment

```bash
npm i -g vercel
vercel --prod
```

Set all env vars in the Vercel dashboard, then:

```bash
DATABASE_URL=<prod-url> npx prisma db push
```

Cron jobs run automatically on Vercel:

| Job | Schedule | Purpose |
|---|---|---|
| `/api/cron/cancel-expired` | Daily 02:00 UTC | Cancel milestones past deadline |
| `/api/cron/connector-health` | Daily 07:00 UTC | Probe enterprise data source URLs |
| `/api/cron/regulatory-alerts` | Monday 08:00 UTC | Fetch CSRD/ESRS updates, classify with AI, notify affected users |

---

## Contract state machine

```
DRAFT
  └─ builder joins ──→ AWAITING_ESCROW
                              └─ requester funds ──→ FUNDED
                                                       └─ builder uploads proof ──→ PROOF_SUBMITTED
                                                                                          ├─ AI YES       ──→ VERIFIED ──→ COMPLETED (NFT minted)
                                                                                          ├─ AI UNCERTAIN ──→ PENDING_REVIEW
                                                                                          │                      ├─ requester approves ──→ VERIFIED ──→ COMPLETED
                                                                                          │                      ├─ requester rejects  ──→ REJECTED (deadline extended)
                                                                                          │                      ├─ builder resubmits  ──→ PROOF_SUBMITTED (loop)
                                                                                          │                      └─ 14 days no action  ──→ VERIFIED ──→ COMPLETED
                                                                                          └─ AI NO        ──→ REJECTED
                                                                                                                 └─ resubmit ──→ FUNDED (loop)
                                                       └─ deadline passed (cron) ──→ EXPIRED
```

---

## Business model

- **Protocol fee (0.5%)** — charged only on successful escrow releases. Cascrow's incentives are aligned with the party paying for results.
- **Verification fee ($0.10/check)** — for verification-only mode (no escrow). AI agents and automated pipelines pay per verification.
- **Enterprise SaaS** — monthly subscription for attestation contracts, team management, audit firm access, and integrations.
- **Reviewer-as-a-Service** — domain experts cast binding votes on high-stakes milestones. €50–2,000 per review.

---

## Roadmap

- **EVM Mainnet** — deploy to XRPL EVM Mainnet when available
- **Expert Review Panel** — AI-matched domain experts, double-blind majority vote
- **Native XRPL Escrow** — parallel escrow path via XLS-85 (no EVM required)
- **Fiat on-ramp** — fund escrows by card or bank transfer; payouts to bank account
- **Dispute resolution** — formal escalation paths and arbitration timelines
- **Agent Reputation Passport** — agents get their own XRPL wallet identity independent of the user account. Verified milestone NFTs accumulate on the agent's address. Any client can check `cascrow.com/agent/<address>` before hiring — a portable, on-chain track record that works across users and devices.

---

## Key design decisions

**Why dual-chain audit?**
The EVM sidechain stores escrow state. The native XRP Ledger stores an independent immutable audit record. Two independent chains, two independent proofs.

**Why AccountSet for XRPL memos?**
Payment-to-self is rejected by XRPL as `temREDUNDANT`. `AccountSet` carries the same memo payload without that constraint.

**Why HTTP JSON-RPC for XRPL?**
Vercel serverless functions stop background work after the HTTP response. WebSocket-based `xrpl.Client` doesn't complete in time. HTTP JSON-RPC calls complete synchronously within the request lifecycle.

**Why MetaMask?**
The platform never holds user private keys. MetaMask signs `approve` + `fundMilestone` on the user's device. The platform wallet only calls `releaseMilestone` / `cancelMilestone` server-side after AI verification.

**Why 5 models?**
No single AI company controls the verdict. Anthropic, Google, OpenAI, Mistral, and Alibaba (via Cerebras) must reach a 3/5 majority. If any single provider is biased, manipulated, or unavailable, the other four still produce a valid result.

**Why Upstash Redis for rate limiting?**
Vercel deploys multiple serverless instances. In-memory counters don't share state across instances. Upstash Redis with INCR+PEXPIRE is atomic across all instances.
