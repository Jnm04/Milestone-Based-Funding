# Cascrow

AI-powered RLUSD escrow agent on the XRPL EVM Sidechain with dual-chain audit trail.  
Grant givers lock RLUSD in a smart contract escrow; funds release automatically when an AI agent verifies the receiver has met the agreed milestone.

Built at the **XRPL Student Builder Residency 2026** · **Claude AI** · **Gemini AI** · **MetaMask** · **Next.js 16**

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
  UNCERTAIN → Grant Giver manually reviews and decides
            → Receiver can also resubmit improved proof (bypasses manual review if AI becomes confident)
            → After 14 days without investor action → funds auto-released
            → If rejected: deadline extended by the exact review duration (receiver doesn't lose waiting time)
  NO        → Receiver can resubmit (until deadline)
              ↓
  Deadline passed → cron job cancels escrow, RLUSD returned
```

Every key event is written to **both chains** as an immutable audit entry:
- **XRPL EVM Sidechain** — hex-encoded JSON in an EVM transaction's `data` field
- **Native XRP Ledger** — JSON memo in an `AccountSet` transaction, publicly verifiable on [testnet.xrpscan.com](https://testnet.xrpscan.com)

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
| `AI_DECISION` | 5-model majority verdict, per-model votes, confidence score, and `sha256(system_prompt)` — proves the evaluation criteria wasn't changed |
| `FUNDS_RELEASED` | Transaction hash of the on-chain RLUSD transfer |

To verify a proof wasn't tampered with: compute `sha256sum` of the original file locally and compare it against the `PROOF_SUBMITTED` record on either chain.

### What the platform still controls

Being transparent about the remaining trust assumptions:

- **AI verdict.** The platform chooses the AI models and constructs the prompt. 5 independent models from 4 different companies (Anthropic, Google, OpenAI, Mistral + Meta/Groq) must reach a 3/5 majority — no single provider can unilaterally determine the outcome. The prompt hash is locked on-chain so prompt changes are detectable.
- **PENDING_REVIEW escalation.** When AI confidence is between 60–85%, the grant giver decides manually. The receiver can resubmit a stronger proof at any time to bypass manual review. If the grant giver takes no action for 14 days, funds are automatically released. If the grant giver rejects, the deadline is automatically extended by the exact duration of the review — so the receiver never loses time they spent waiting.
- **Proof storage.** Files are stored in Vercel Blob (private). The SHA-256 hash is locked on-chain, so tampering is detectable — but access to the file itself depends on the platform remaining operational.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind CSS, shadcn/ui |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js) |
| Blockchain | XRPL EVM Sidechain (Testnet), Solidity smart contract |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI | Claude `claude-haiku-4-5-20251001` + Gemini `gemini-2.5-flash` + GPT-4o-mini + Mistral Small + Qwen3-235B via Cerebras (5-model majority vote, 3/5 required) |
| Audit trail | Dual-chain: XRPL EVM Sidechain + native XRP Ledger (AccountSet memos via HTTP JSON-RPC) |
| Database | PostgreSQL + Prisma |
| File storage | Vercel Blob |
| Email | Resend |
| Cron | Vercel Cron (auto-cancel expired milestones) |

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
EVM_RPC_URL=https://rpc.testnet.xrplevm.org
NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS=0x...
PLATFORM_WALLET_PRIVATE_KEY=0x...   # Platform wallet — releases/cancels escrow server-side

# Native XRPL audit trail (AccountSet memo transactions)
XRPL_PLATFORM_SEED=s...             # XRPL testnet wallet seed (fund via testnet faucet)
# XRPL_HTTP_URL=https://s.altnet.rippletest.net:51234  # optional override

# Email (optional — notifications disabled without this)
RESEND_API_KEY=re_...
EMAIL_FROM=Cascrow <noreply@yourdomain.com>

# Cron (set to any secret string, must match Vercel Cron config)
CRON_SECRET=your-secret
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
│   │   ├── auth/          # Register, login, email verification, resend
│   │   ├── contracts/     # Create, join, decline, resubmit, review, preview
│   │   ├── escrow/        # Create calldata, confirm funding, finish, cancel
│   │   ├── proof/         # PDF/image upload → Vercel Blob
│   │   ├── verify/        # AI milestone verification
│   │   ├── profile/       # User profile + notification preferences
│   │   ├── user/wallet/   # Save wallet address
│   │   ├── cron/          # Auto-cancel expired milestones
│   │   └── health/        # Health check
│   ├── contract/[id]/     # Contract detail page (incl. audit trail)
│   ├── dashboard/         # Grant giver + receiver dashboards
│   ├── login/             # Sign in
│   ├── register/          # Sign up + email verification screen
│   ├── profile/           # Profile settings
│   └── page.tsx           # Landing page
├── services/
│   ├── ai/                # Claude + Gemini dual-model verifier (PDF + image)
│   ├── evm/               # EVM client, escrow calldata, release/cancel, audit
│   └── xrpl/              # Native XRPL audit memo writer (HTTP JSON-RPC)
├── components/
│   └── audit-trail.tsx    # On-chain audit trail UI with xrpscan.com links
└── lib/
    ├── prisma.ts
    ├── auth-options.ts
    └── email.ts            # Resend email templates
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
