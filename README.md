# Cascrow

**AI-powered milestone escrow and enterprise attestation platform.**

Cascrow solves a fundamental trust problem: how do you pay someone for results, not just effort — and prove it happened? We enforce that at two levels:

- **Escrow mode** — lock RLUSD in a smart contract on the XRPL EVM Sidechain; an AI panel of 5 independent models must reach a 3/5 majority before a single cent moves.
- **Attestation mode** — enterprise teams track and verify ESG, sustainability, and KPI commitments without moving money. Every verdict is written to the XRP Ledger as a permanent, tamper-evident record.

Built at the **XRPL Student Builder Residency 2026** — post-Demo Day, moving toward real market launch.

---

## The problem we solve

Grant givers, investors, and enterprise compliance teams all face the same issue: **the people they fund or audit can tell them anything**. Milestones get rubber-stamped. Reports are filed and forgotten. Proof is a PDF that no one verifies.

Cascrow replaces handshake trust with verifiable finality:

- **Escrow users** don't release money based on a message — they release it based on a majority AI verdict, locked on-chain before it executes.
- **Enterprise users** don't just store sustainability goals — they submit evidence, get AI-verified verdicts, and mint an immutable NFT certificate that exists on the XRP Ledger independent of Cascrow.
- **Audit firms** get read-only access to their clients' attestation history, cryptographically tied to the original evidence, without touching the underlying systems.
- **Startups** build an on-chain track record of completed, verified milestones — a public portfolio that no one can fake.

---

## How Escrow mode works

```
Investor creates contract with milestone(s), amounts, deadlines
              ↓
Startup accepts via invite link
              ↓
Investor approves RLUSD + signs fundMilestone via MetaMask
  → RLUSD locked in smart contract; platform cannot redirect it
              ↓
Startup uploads PDF, image, or links a GitHub repo as proof
              ↓
5 AI models evaluate in parallel (Claude, Gemini, GPT-4o-mini, Mistral, Qwen3 via Cerebras)
3/5 majority required
              ↓
  YES        → funds released automatically to startup
             → non-transferable completion NFT minted on native XRP Ledger
  UNCERTAIN  → investor reviews manually
             → startup can resubmit stronger proof at any time (bypasses manual review)
             → 14 days no investor action → auto-release + NFT
             → if rejected: deadline extended by exact review duration (startup doesn't lose waiting time)
  NO         → startup can resubmit until deadline
              ↓
  Deadline passed → cron cancels escrow, RLUSD returned to investor
```

Multi-milestone contracts are fully supported — each milestone has its own escrow, proof cycle, and NFT.

---

## How Attestation mode works

For enterprise teams that need compliance evidence but aren't moving crypto:

```
Enterprise user creates an attestation contract (ESG / KPI / CSRD goal)
              ↓
Startup or internal team submits evidence (PDF, GitHub, API endpoint)
              ↓
Same 5-model AI panel evaluates — verdict written to XRP Ledger
              ↓
  VERIFIED   → NFT completion certificate minted on XRP Ledger
             → Slack / Teams notification sent to configured channels
  REJECTED   → Team can resubmit with improved evidence
              ↓
Audit firm partner reviews full attestation history (read-only, access granted/revoked by client)
```

Attestation contracts support:
- **Confidential goals** — goal text encrypted with AES-256-GCM; hash stored on-chain so the commitment is provable without revealing content
- **Data connector health monitoring** — REST API or URL-based data sources are probed daily; unhealthy connectors trigger email escalation
- **Regulatory change alerts** — CSRD/ESRS updates from EUR-Lex and EFRAG are classified weekly by AI and pushed to affected users via email and Slack/Teams
- **ESRS/GRI tagging** — milestones tagged with regulatory standards for materiality mapping and audit traceability

---

## Trustless by design

Neither party needs to trust the platform. Every critical guarantee is enforced on-chain.

### What the smart contract enforces

- **Funds go to one address only.** The receiver's wallet is written into the escrow at funding time and cannot be changed. The platform cannot redirect RLUSD to itself.
- **Anyone with the fulfillment key can release.** `releaseMilestone` is callable by any address. When AI approves, the platform emails the fulfillment key to the receiver. If Cascrow goes offline, the receiver can execute on-chain directly with MetaMask.
- **The investor can cancel without us.** After deadline, `cancelMilestone` is callable directly by the investor.
- **The condition is locked on-chain.** `keccak256(fulfillment)` is stored at funding time. The platform cannot produce a different key later.

### What the audit trail proves

Every event is written to two independent chains before the platform responds:

| Event | What's locked on-chain |
|---|---|
| `ESCROW_FUNDED` | `keccak256(milestoneTitle)` — agreed criteria at the moment money was locked |
| `PROOF_SUBMITTED` | `sha256(file)` — the exact file the AI evaluated; receiver can verify theirs wasn't swapped |
| `AI_DECISION` | 5-model verdict, per-model votes, confidence score, `sha256(system_prompt)` — proves the evaluation criteria wasn't changed |
| `FUNDS_RELEASED` | On-chain RLUSD transaction hash |

To verify a proof wasn't tampered with: run `sha256sum` on the original file and compare against the `PROOF_SUBMITTED` record on either chain.

### Remaining trust assumptions (transparent)

- **AI verdict** — the platform selects models and constructs the prompt. 5 models from 5 different companies (Anthropic, Google, OpenAI, Mistral, Alibaba/Cerebras) must reach a 3/5 majority. The prompt hash is locked on-chain so changes are detectable.
- **PENDING_REVIEW** — when confidence is borderline, the grant giver decides. Auto-release after 14 days prevents indefinite blocking.
- **Proof storage** — files are in Vercel Blob. The SHA-256 hash is on-chain so tampering is detectable, but access to the file depends on the platform staying operational.

---

## Enterprise features

Cascrow includes a full enterprise tier built for institutional users:

- **Team management** — invite team members with roles (Owner, Admin, Member); assign members to entities
- **Multi-entity / group structure** — model subsidiaries and business units; consolidated roll-up dashboard across all entities
- **SSO / SAML** — WorkOS-compatible single sign-on configuration per organisation
- **Slack & Teams integration** — OAuth-based Slack and webhook-based Teams; receive real-time notifications on verification outcomes, deadline warnings, and connector errors
- **Audit firm access** — grant named auditors read-only access to your attestation history with revocable access control
- **API keys** — programmatic access for automated submissions
- **Deal Rooms** — invite a startup into a due-diligence workspace; they upload documents, you get an AI-generated brief, then convert to a contract or decline with one click

---

## XRPL NFT Completion Certificates

When a milestone is verified and funds are released (or an attestation is completed), Cascrow mints a **non-transferable `NFTokenMint`** on the native XRP Ledger.

The NFT serves two purposes:

**Proof of completion** — a permanent, tamper-proof record that a specific milestone was AI-verified. Even if Cascrow goes offline, the certificate remains on the XRP Ledger and is publicly verifiable. Useful for grant programs, NGOs, and development aid organisations that require documented accountability on a public ledger.

**On-chain track record** — over time, a startup builds a collection of completion NFTs across different contracts and investors. This becomes a verifiable portfolio of AI-verified, real-money-backed work — no self-reported credentials, no references.

Non-transferable means the certificate is a credential, not an asset. It cannot be sold or transferred.

---

## Cascrow Brain — training a custom verification model

Every verification run contributes to a labeled dataset:

- **Automatic labeling** — 5/0 and 4/1 consensus results are written directly to training data.
- **Human review queue** — 3/2 disagreements are routed to internal review before entering the dataset.
- **Fraud tagging** — reviewers can flag entries as `FAKED` with type (`AI_GENERATED`, `MANIPULATED`, `RECYCLED`) to train the model to detect fabricated proofs.

The goal: a fine-tuned verification model trained on real milestone-proof pairs, not generic LLMs prompted at inference time. Exportable as JSONL (OpenAI / Anthropic / Hugging Face fine-tuning format) at any time.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| UI | Tailwind CSS — dark copper/amber design system |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js, EIP-1193) |
| Escrow | XRPL EVM Sidechain (Chain ID 1449000), Solidity `MilestoneFundEscrow` |
| NFT + Audit | Native XRP Ledger — `NFTokenMint` + `AccountSet` memos via xrpl.js |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI verification | 5-model majority vote: Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Qwen3 via Cerebras |
| AI features | Claude Haiku (deal room briefs, regulatory alert classification) |
| Database | PostgreSQL + Prisma ORM |
| File storage | Vercel Blob |
| Rate limiting | Upstash Redis (INCR+PEXPIRE, cross-instance safe for serverless) |
| Email | Resend (via SMTP) |
| Notifications | Slack (OAuth + chat.postMessage), Microsoft Teams (incoming webhook) |
| Cron | Vercel Cron — expired escrow cancellation, connector health probes, regulatory alert ingestion |
| Error monitoring | Sentry (EU region, Frankfurt) |
| Bot protection | Cloudflare Turnstile (register + forgot-password) |

---

## Local development

### Prerequisites

- Node.js 20+
- PostgreSQL
- API keys: Anthropic, Google Gemini, OpenAI, Mistral, Cerebras
- Vercel Blob token
- Upstash Redis (REST URL + token)
- Resend API key (optional — email features disabled without it)

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

# Encryption (Slack token storage, confidential goals, Slack OAuth state HMAC)
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

> **XRPL wallet setup:** create a testnet wallet at [xrpl.org/xrp-testnet-faucet.html](https://xrpl.org/xrp-testnet-faucet.html), copy the seed to `XRPL_PLATFORM_SEED`. Wallet needs ~10 XRP reserve + fees.

### Database setup

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

Set all env vars in the Vercel dashboard, then sync the database:

```bash
DATABASE_URL=<prod-url> npx prisma db push
```

Cron jobs are configured in `vercel.json` and run automatically on Vercel:

| Job | Schedule | Purpose |
|---|---|---|
| `/api/cron/cancel-expired` | Daily 02:00 UTC | Cancel milestones past deadline |
| `/api/cron/connector-health` | Daily 07:00 UTC | Probe enterprise data source URLs |
| `/api/cron/regulatory-alerts` | Monday 08:00 UTC | Fetch CSRD/ESRS updates, classify with AI, notify affected users |

---

## Contract state machine

```
DRAFT
  └─ startup joins ──→ AWAITING_ESCROW
                              └─ investor funds ──→ FUNDED
                                                       └─ startup uploads proof ──→ PROOF_SUBMITTED
                                                                                          ├─ AI YES       ──→ VERIFIED ──→ COMPLETED (NFT minted)
                                                                                          ├─ AI UNCERTAIN ──→ PENDING_REVIEW
                                                                                          │                      ├─ investor approves ──→ VERIFIED ──→ COMPLETED
                                                                                          │                      ├─ investor rejects  ──→ REJECTED (deadline extended)
                                                                                          │                      ├─ startup resubmits ──→ PROOF_SUBMITTED (loop)
                                                                                          │                      └─ 14 days no action ──→ VERIFIED ──→ COMPLETED
                                                                                          └─ AI NO        ──→ REJECTED
                                                                                                                 └─ resubmit ──→ FUNDED (loop)
                                                       └─ deadline passed (cron) ──→ EXPIRED
```

---

## Roadmap

### EVM Mainnet

Deploy to XRPL EVM Mainnet when available. Same flow, real RLUSD, real stakes.

### Risk-based KYC

No unnecessary friction for small contracts. Verification scales with amount.

| Tier | Verification | Limit |
|---|---|---|
| Tier 0 | Email verified | up to $1K |
| Tier 1 | Name + sanctions screening | up to $10K |
| Tier 2 | ID + liveness check | up to $100K |
| Tier 3 | KYB + source of funds | unlimited |

### Expert Review Panel

For high-stakes milestones: curated domain experts receive an AI-generated report and cast binding votes — double-blind, majority required. The **Reviewer-as-a-Service** model: €50–2,000 per review depending on domain and complexity.

### Native XRPL Escrow

Parallel escrow path via native XRPL XLS-85 (Xumm / Crossmark) — RLUSD in native escrow, no EVM smart contracts required.

### Fiat On-ramp

Fund escrows by card or bank transfer. Payouts settle to a bank account — no crypto wallet needed on the receiver side.

### Structured Dispute Resolution

Formal escalation paths, arbitration timelines, and binding decisions for every edge case.

---

## Key design decisions

**Why dual-chain audit?**
The EVM sidechain stores escrow state and business logic. The native XRP Ledger stores an independent immutable audit record via `AccountSet` memo transactions — verifiable without trusting our backend. Two independent chains, two independent proofs.

**Why AccountSet for XRPL memos?**
`AccountSet` doesn't require a destination and supports arbitrary Memos. Payment-to-self is rejected by XRPL as `temREDUNDANT`. `AccountSet` carries the same memo payload without that constraint.

**Why HTTP JSON-RPC for XRPL?**
Vercel serverless functions stop background work after the HTTP response. WebSocket-based `xrpl.Client` with `submitAndWait` doesn't complete in time. HTTP JSON-RPC calls complete synchronously within the request lifecycle.

**Why MetaMask?**
The platform never holds user private keys. MetaMask signs `approve` + `fundMilestone` on the user's device. The platform wallet only calls `releaseMilestone` / `cancelMilestone` server-side after AI verification.

**Why 5 models?**
No single AI company controls the verdict. Anthropic, Google, OpenAI, Mistral, and Alibaba (via Cerebras) must reach a 3/5 majority. If any single provider's model is biased, manipulated, or unavailable, the other four still produce a valid result.

**Why Upstash Redis for rate limiting?**
Vercel deploys multiple serverless instances. In-memory counters don't share state across instances. Upstash Redis with INCR+PEXPIRE is atomic across all instances without requiring a persistent connection.
