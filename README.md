# Cascrow

AI-powered RLUSD escrow agent on the XRPL EVM Sidechain with dual-chain audit trail.  
Grant givers lock RLUSD in a smart contract escrow; funds release automatically when an AI agent verifies the receiver has met the agreed milestone.

Built at the **XRPL Student Builder Residency 2026** 

---

## How it works

```
Grant Giver creates contract  →  Receiver accepts invite link
              ↓
Grant Giver approves RLUSD + signs fundMilestone via MetaMask
              ↓
Receiver uploads PDF/image proof of milestone completion
              ↓
5 independent AI models verify the proof — 3/5 majority required (Claude, Gemini, GPT-4o-mini, Mistral Small, Qwen3-235B via Cerebras)
              ↓
  YES       → funds automatically released to receiver
            → non-transferable NFT minted on XRPL Ledger as permanent completion certificate
  UNCERTAIN → Grant Giver manually reviews and decides
            → Receiver can also resubmit improved proof (bypasses manual review if AI becomes confident)
            → After 14 days without investor action → funds auto-released + NFT minted
            → If rejected: deadline extended by the exact review duration (receiver doesn't lose waiting time)
  NO        → Receiver can resubmit (until deadline)
              ↓
  Deadline passed → cron job cancels escrow, RLUSD returned
```

Every completed milestone triggers a **non-transferable NFT mint on the native XRPL Ledger** — an immutable completion certificate that exists permanently on-chain, independent of Cascrow. See the [XRPL NFT Certificates](#xrpl-nft-completion-certificates) section below.

Every key event is written to **both chains** as an immutable audit entry:
- **XRPL EVM Sidechain** — hex-encoded JSON in an EVM transaction's `data` field
- **Native XRP Ledger** — JSON memo in an `AccountSet` transaction, publicly verifiable on [xrpscan.com](https://xrpscan.com)

---

## Trustless by design

Cascrow is built so that neither party needs to trust the platform. Every critical guarantee is enforced on-chain — the platform cannot block payments, redirect funds, swap proof files, or falsify the agreed milestone criteria.

### What the smart contract enforces

- **Funds go to one address only.** The receiver's wallet address is written into the escrow at funding time and cannot be changed. The platform has no ability to redirect RLUSD to itself.
- **Anyone with the fulfillment key can release.** `releaseMilestone(contractId, order, fulfillment)` is callable by any address — not just the platform. When AI approves, the platform emails the fulfillment key directly to the receiver. If the platform disappears, the receiver can self-execute on-chain using any EVM wallet (MetaMask, etc.) without involving us.
- **The investor can cancel without us.** After the deadline, `cancelMilestone` can be called directly by the investor — no platform action required.
- **The condition is locked on-chain.** The smart contract stores `keccak256(fulfillment)` at funding time. The platform cannot generate a different fulfillment key later and claim it works — the hash must match exactly.

### What the audit trail proves

Every event is written to two independent chains (XRPL EVM Sidechain + native XRP Ledger) before the platform responds. The metadata in each on-chain record includes:

| Event | What's locked on-chain |
|---|---|
| `ESCROW_FUNDED` | `keccak256(milestoneTitle)` — the agreed criteria at the moment money was locked |
| `PROOF_SUBMITTED` | `sha256(file)` — the exact file the AI evaluated; receiver can verify their file wasn't swapped |
| `AI_DECISION` | 5-model majority verdict (Claude, Gemini, GPT-4o-mini, Mistral, Qwen), per-model votes, confidence score, and `sha256(system_prompt)` — proves the evaluation criteria wasn't changed |
| `FUNDS_RELEASED` | Transaction hash of the on-chain RLUSD transfer |

To verify a proof wasn't tampered with: compute `sha256sum` of the original file locally and compare it against the `PROOF_SUBMITTED` record on either chain.

### What the platform still controls

Being transparent about the remaining trust assumptions:

- **AI verdict.** The platform chooses the AI models and constructs the prompt. 5 independent models from 5 different companies (Anthropic, Google, OpenAI, Mistral, Alibaba/Cerebras) must reach a 3/5 majority — no single provider can unilaterally determine the outcome. The prompt hash is locked on-chain so prompt changes are detectable.
- **PENDING_REVIEW escalation.** When AI confidence is between 60–85%, the grant giver decides manually. The receiver can resubmit a stronger proof at any time to bypass manual review. If the grant giver takes no action for 14 days, funds are automatically released. If the grant giver rejects, the deadline is automatically extended by the exact duration of the review — so the receiver never loses time they spent waiting.
- **Proof storage.** Files are stored in Vercel Blob (private). The SHA-256 hash is locked on-chain, so tampering is detectable — but access to the file itself depends on the platform remaining operational.

---

## XRPL NFT Completion Certificates

When a milestone is completed and RLUSD is released, Cascrow automatically mints a **non-transferable `NFTokenMint`** on the native XRPL Ledger as an immutable on-chain completion certificate.

### Two purposes

**1. Proof of completion**

The NFT is a permanent, tamper-proof record that a specific milestone was AI-verified and funds were released. It contains all relevant metadata in its URI:

```json
{
  "p": "cascrow",
  "c": "<contractId>",
  "m": "Delivered market research report",
  "a": "500",
  "t": "2026-04-07",
  "tx": "0xabc123ab"
}
```

*(Compact keys are required to stay within the XRPL 256-byte URI field limit.)*

Even if Cascrow goes offline, the NFT remains on the XRPL Ledger and is publicly verifiable at `https://xrpl.org/nft/<tokenId>`. Useful for grant programs (KfW, NGOs, development aid) that require documented accountability — the proof is on a public ledger, not in a private database.

**2. On-chain reputation and track record**

Over time, a startup, freelancer, or project team builds a collection of completion NFTs across different contracts and grant givers. This becomes a verifiable on-chain portfolio:

> *"Here are 12 milestones I completed, each verified by AI and backed by real RLUSD payouts — all on the XRPL Ledger."*

No resume, no references, no self-reported credentials. The ledger speaks for itself. Grant givers can look up a receiver's XRPL wallet address and see their full history of completed, AI-verified work before funding a new contract.

### Technical details

```
Transaction type:   NFTokenMint
Flags:              0  (tfTransferable NOT set — non-transferable)
NFTokenTaxon:       1  (cascrow milestone certificates)
URI:                hex-encoded JSON metadata
Minted by:          platform wallet (XRPL_PLATFORM_SEED)
Explorer:           https://xrpl.org/nft/<tokenId>
```

Non-transferable means the certificate cannot be sold, traded, or transferred to another wallet. It is a credential, not an asset — tied permanently to the platform wallet as proof that the work was done.

The `tokenId` and `txHash` are stored in the database and displayed as a certificate card on the contract detail page, with direct links to the XRPL Explorer.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind CSS, shadcn/ui |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js) |
| Escrow (smart contract) | XRPL EVM Sidechain (Testnet), Solidity — `MilestoneFundEscrow` |
| NFT + Audit (native ledger) | Native XRP Ledger — `NFTokenMint` + `AccountSet` memos via xrpl.js |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI | Claude `claude-haiku-4-5-20251001` + Gemini `gemini-2.5-flash` + GPT-4o-mini + Mistral Small + Qwen3-235B via Cerebras (5-model majority vote, 3/5 required) |
| Database | PostgreSQL + Prisma |
| File storage | Vercel Blob |
| Email | Resend (via SMTP) |
| Cron | Vercel Cron (auto-cancel expired milestones) |
| Error monitoring | Sentry (EU region, Frankfurt) |
| Bot protection | Cloudflare Turnstile (register + forgot-password) |
| Charts | Recharts (internal dashboard) |
| 3D graph | React Three Fiber + D3 Force 3D (internal contract graph) |

---

## Local development

### 1. Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted)
- Anthropic API key
- Google Gemini API key
- Vercel Blob token
- Resend API key (optional — email features disabled without it)

### 2. Install

```bash
cd milestonefund
npm install
```

### 3. Environment variables

Create `.env.local` with the following:

```env
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# AI (5-model majority vote)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
CEREBRAS_API_KEY=csk_...

# File storage
BLOB_READ_WRITE_TOKEN=  # Vercel Blob token

# EVM / Blockchain
NEXT_PUBLIC_EVM_RPC_URL=https://rpc.testnet.xrplevm.org
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS=0x...
EVM_PLATFORM_PRIVATE_KEY=0x...      # Platform wallet — releases/cancels escrow server-side

# Native XRPL audit trail (AccountSet memo transactions)
XRPL_PLATFORM_SEED=s...             # XRPL wallet seed (fund at xrpl.org/xrp-testnet-faucet.html)
# XRPL_NETWORK=testnet              # Omit for mainnet (default)

# Email (Resend — required for verification/reset; optional notifications work without it)
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=465
EMAIL_USER=resend
EMAIL_PASS=re_...
EMAIL_FROM=Cascrow <noreply@yourdomain.com>

# Bot protection
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=...
CLOUDFLARE_TURNSTILE_SECRET_KEY=...

# Error monitoring (Sentry — optional, errors silently skipped if missing)
NEXT_PUBLIC_SENTRY_DSN=https://...@....ingest.de.sentry.io/...
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=...   # Personal Token (Project: Read + Issue & Event: Read scopes)

# Internal admin API (set to any long random string)
INTERNAL_API_SECRET=...

# Cron (set to any secret string, must match Vercel Cron config)
CRON_SECRET=...
```

> **XRPL audit wallet setup:** Create a testnet wallet at [xrpl.org/xrp-testnet-faucet.html](https://xrpl.org/xrp-testnet-faucet.html), copy the seed into `XRPL_PLATFORM_SEED`. The wallet needs ~10 XRP reserve + small amount for fees.

### 4. Database setup

```bash
npx prisma db push
npx prisma generate
```

### 5. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Vercel deployment

### Deploy

```bash
npm i -g vercel
vercel --prod
```

### Environment variables

Set all variables from the section above in the Vercel dashboard under **Settings → Environment Variables**.

After deploying, sync the database:

```bash
DATABASE_URL=<prod-url> npx prisma db push
```

### Cron job

The cron job at `/api/cron/cancel-expired` runs daily and cancels any milestone whose deadline has passed. Configure it in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cancel-expired",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/              # NextAuth + register, verify-email, reset-password
│   │   ├── contracts/[id]/    # CRUD, join/decline, review, resubmit, calendar, preview
│   │   ├── escrow/            # Create, confirm, finish, cancel, sync, webhook
│   │   ├── proof/             # PDF/image upload → Vercel Blob; DELETE proof
│   │   ├── verify/            # AI milestone verification (5-model vote)
│   │   ├── nft/               # Mint NFT cert, cert image, cert metadata
│   │   ├── user/              # Wallet save, GDPR export, GDPR delete, recheck-kyc
│   │   ├── webhooks/          # Outbound webhook delivery
│   │   ├── telegram/          # Bot connect + webhook handler
│   │   ├── internal/          # Admin APIs (stats, export, queue, graph, generate, dataset, sentry-issues, users)
│   │   ├── cron/              # Auto-cancel expired milestones + refresh sanctions
│   │   └── health/            # Health check
│   ├── contract/[id]/         # Contract detail + audit trail + milestone timeline
│   ├── dashboard/             # Investor + startup dashboards
│   ├── internal/              # Admin panel (stats, review queue, errors, usage, graph, generate, dataset, users)
│   ├── datenschutz/           # Bilingual Privacy Policy (DE/EN toggle)
│   ├── login/ register/ forgot-password/ reset-password/ profile/
│   └── page.tsx               # Landing page
├── services/
│   ├── ai/                    # 5-model verifier — PDF + image
│   ├── brain/                 # Proof enrichment, embeddings, training data collection
│   ├── evm/                   # EVM client, escrow calldata, release/cancel, audit
│   ├── xrpl/                  # Native XRPL: audit memos + NFT cert minter
│   ├── github/                # GitHub proof validation
│   ├── sanctions/             # OFAC/EU sanctions screening
│   ├── telegram/              # Bot notifications
│   └── webhook/               # Outbound webhook delivery
├── components/
│   ├── audit-trail.tsx        # On-chain audit trail UI with xrpscan.com links
│   ├── cookie-banner.tsx      # Cookie info banner (strictly necessary only)
│   ├── proof-upload.tsx       # PDF/image proof upload with XHR progress
│   └── ...
├── lib/
│   ├── prisma.ts
│   ├── auth-options.ts
│   ├── rate-limit.ts          # In-memory rate limiter
│   ├── env-validation.ts      # Startup env var check (throws on missing required vars)
│   └── email.ts               # Nodemailer/Resend email templates
└── sentry.*.config.ts         # Sentry client/server/edge config (production only)
```

---

## On-chain audit trail

Every contract lifecycle event is written to both chains simultaneously and stored in the database:

| Event | Trigger |
|---|---|
| `CONTRACT_CREATED` | Investor creates a new contract |
| `ESCROW_FUNDED` | Grant giver funds milestone via MetaMask |
| `PROOF_SUBMITTED` | Receiver uploads proof document |
| `AI_DECISION` | Claude + Gemini return a combined verdict |
| `MANUAL_REVIEW_APPROVED` | Grant giver manually approves — or auto-approved after 14 days inactivity |
| `MANUAL_REVIEW_REJECTED` | Grant giver manually rejects — deadline extended by review duration (logged in metadata) |
| `FUNDS_RELEASED` | RLUSD released to receiver |
| `NFT_MINTED` | Completion certificate minted on XRPL Ledger — `tokenId` + explorer URL in metadata |
| `ESCROW_CANCELLED` | Deadline passed, RLUSD returned |
| `PROOF_RESUBMITTED` | Receiver resubmits after rejection |

Each entry stores:
- `evmTxHash` — EVM sidechain transaction hash
- `xrplTxHash` — Native XRP Ledger transaction hash (clickable link to xrpscan.com)

The audit trail is displayed on every contract detail page as a timestamped timeline.

---

## Contract state machine

```
DRAFT
  └─ receiver joins ──→ AWAITING_ESCROW
                               └─ grant giver funds ──→ FUNDED
                                                            └─ receiver uploads proof ──→ PROOF_SUBMITTED
                                                                                                └─ AI YES       ──→ VERIFIED ──→ COMPLETED
                                                                                                └─ AI UNCERTAIN ──→ PENDING_REVIEW
                                                                                                │                       └─ investor APPROVE ──→ VERIFIED ──→ COMPLETED
                                                                                                │                       └─ investor REJECT  ──→ REJECTED (deadline extended by review duration)
                                                                                                │                       └─ receiver resubmits better proof ──→ PROOF_SUBMITTED (loop)
                                                                                                │                       └─ 14 days no action (cron) ──→ VERIFIED ──→ COMPLETED
                                                                                                └─ AI NO        ──→ REJECTED
                                                                                                                        └─ resubmit ──→ FUNDED (loop)
                                                            └─ deadline passed (cron) ──→ EXPIRED
```

---

## Roadmap

Post-Demo Day (April 2026) — moving toward real market launch. Here's what's next.

### Compliance — Risk-based KYC

No unnecessary friction for small grants. Verification scales with the amount at stake.

| Tier | Verification | Limit | Status |
|------|-------------|-------|--------|
| Tier 0 | Email verified | up to $1K | **live now** |
| Tier 1 | Name + Sanctions screening | up to $10K | planned |
| Tier 2 | ID + Liveness check | up to $100K | planned |
| Tier 3 | KYB + Source of funds | unlimited | planned |

### Expert Review — Human-in-the-loop

For high-stakes decisions, AI generates a detailed report reviewed by a curated panel of domain experts. Double-blind, majority vote. This is the **Reviewer-as-a-Service** model: AI matched experts evaluate the milestone proof and cast binding votes — no single party has unilateral control.

### Multi-chain Settlement

Before creating a contract, choose where the escrow settles:
- **Native XRPL Ledger** via XLS-85 amendment (Xumm / Crossmark) — RLUSD in native escrow, no smart contracts
- **XRPL EVM Sidechain** (MetaMask) — Solidity escrow, currently live on testnet

Same trustless flow, your chain.

### Mainnet

Mainnet launch with fiat on-ramp — fund escrows directly by card or bank transfer. Payouts go straight to a bank account, no crypto wallet required on the receiver side.

### Structured Dispute Resolution

A formal dispute workflow with escalation paths, arbitration timelines, and binding decisions — so every edge case has a clear, fair outcome.

### Active Intelligence

AI that goes beyond uploaded documents — querying GitHub to analyze code, checking public APIs, and cross-referencing live data. Weighted confidence scores replace binary YES/NO decisions as models improve.

---

## Cascrow Brain — Training a Custom Verification Model

The long-term AI goal is a **fine-tuned verification model trained entirely on real milestone-proof pairs** — not generic LLMs prompted at inference time, but a model that has internalized what "proof of milestone completion" actually looks like across domains.

### How training data is collected

Every verification run contributes to a labeled dataset:

- **5-model majority vote** — Claude, Gemini, GPT-4o-mini, Mistral Small, and Cerebras/Qwen3 each independently evaluate the proof. The majority verdict becomes the label.
- **Automatic labeling** — 5/0 and 4/1 consensus results are written directly to the training dataset (`AUTO_5_0` / `AUTO_4_1` label sources).
- **Human review queue** — 3/2 splits (genuine disagreement) are routed to an internal review interface where a human labels the case as `APPROVED`, `REJECTED`, or `FAKED` before it enters the dataset.
- **Fraud detection** — Human reviewers can flag entries as `FAKED` with a fraud type (`AI_GENERATED`, `MANIPULATED`, `RECYCLED`, `IMPLAUSIBLE`) to train the model to detect fabricated proofs.

### Export

The dataset can be exported as **JSONL** (ready for fine-tuning via OpenAI, Anthropic, or Hugging Face) or **CSV** at any time from the internal dashboard.

---

## Key design decisions

**Why dual-chain audit?**  
The EVM sidechain stores business logic and escrow state. The native XRP Ledger stores an independent, immutable audit record via `AccountSet` memo transactions — publicly verifiable without trusting our backend. Two independent chains means two independent proofs.

**Why AccountSet for XRPL memos?**  
`AccountSet` transactions don't require a destination address and support arbitrary Memos. Payment-to-self is rejected by XRPL as `temREDUNDANT`; `AccountSet` has no such restriction.

**Why HTTP JSON-RPC for XRPL?**  
Vercel serverless functions kill background work after the HTTP response is sent. WebSocket-based `xrpl.Client` with `submitAndWait` doesn't complete in time. HTTP JSON-RPC calls complete synchronously within the request lifecycle.

**Why EVM smart contracts?**  
XRPL EVM Sidechain gives us Solidity smart contracts with full programmability, while staying in the XRPL ecosystem and using RLUSD as the native stablecoin.

**Why MetaMask?**  
The platform never holds user private keys. MetaMask signs the `approve` + `fundMilestone` transactions on the user's device. The platform wallet only calls `releaseMilestone` / `cancelMilestone` server-side after AI verification.

**Why PENDING_REVIEW?**  
When AI confidence is below a threshold, instead of making a wrong call, the system escalates to the grant giver for a manual decision. This is the Tier 2 governance model.

**Email verification**  
All new accounts require email verification before sign-in. Tokens expire in 24 hours; resend is rate-limited to once per 60 seconds server-side.
