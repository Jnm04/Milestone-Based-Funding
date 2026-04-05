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
Claude + Gemini both verify the proof — both must return YES, NO, or UNCERTAIN
              ↓
  YES       → funds automatically released to receiver
  UNCERTAIN → Grant Giver manually reviews and decides
  NO        → Receiver can resubmit (until deadline)
              ↓
  Deadline passed → cron job cancels escrow, RLUSD returned
```

Every key event is written to **both chains** as an immutable audit entry:
- **XRPL EVM Sidechain** — hex-encoded JSON in an EVM transaction's `data` field
- **Native XRP Ledger** — JSON memo in an `AccountSet` transaction, publicly verifiable on [testnet.xrpscan.com](https://testnet.xrpscan.com)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind CSS, shadcn/ui |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js) |
| Blockchain | XRPL EVM Sidechain (Testnet), Solidity smart contract |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI | Claude `claude-haiku-4-5` + Gemini `gemini-2.5-flash` (dual-model, both must approve) |
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

# AI
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

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
| `AI_DECISION` | Claude + Gemini return a verdict |
| `MANUAL_REVIEW_APPROVED` | Grant giver manually approves |
| `MANUAL_REVIEW_REJECTED` | Grant giver manually rejects |
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
                                                                                                │                       └─ investor REJECT  ──→ REJECTED
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
