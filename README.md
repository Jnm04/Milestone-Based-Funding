# Cascrow

AI-powered RLUSD escrow agent on the XRPL EVM Sidechain.  
Grant givers lock RLUSD in a smart contract escrow; funds release automatically when an AI agent verifies the receiver has met the agreed milestone.

Built at the **XRPL Student Builder Residency 2026** · **Claude AI** · **MetaMask** · **Next.js 16**

---

## How it works

```
Grant Giver creates contract  →  Receiver accepts invite link
              ↓
Grant Giver approves RLUSD + signs fundMilestone via MetaMask
              ↓
Receiver uploads PDF/image proof of milestone completion
              ↓
Claude AI reads the proof and returns YES, NO, or UNCERTAIN
              ↓
  YES       → funds automatically released to receiver
  UNCERTAIN → Grant Giver manually reviews and decides
  NO        → Receiver can resubmit (until deadline)
              ↓
  Deadline passed → cron job cancels escrow, RLUSD returned
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind CSS, shadcn/ui |
| Auth | NextAuth.js — email/password with email verification |
| Wallet | MetaMask (ethers.js) |
| Blockchain | XRPL EVM Sidechain (Testnet), Solidity smart contract |
| Stablecoin | RLUSD (ERC-20 on XRPL EVM) |
| AI | Claude `claude-haiku-4-5` + Gemini `gemini-2.5-flash` (dual-model, both must approve) |
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

# Email (optional — notifications disabled without this)
RESEND_API_KEY=re_...
EMAIL_FROM=Cascrow <noreply@yourdomain.com>

# Cron (set to any secret string, must match Vercel Cron config)
CRON_SECRET=your-secret
```

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
│   ├── contract/[id]/     # Contract detail page
│   ├── dashboard/         # Grant giver + receiver dashboards
│   ├── login/             # Sign in
│   ├── register/          # Sign up + email verification screen
│   ├── profile/           # Profile settings
│   └── page.tsx           # Landing page
├── services/
│   ├── ai/                # Claude verifier (PDF + image)
│   └── evm/               # EVM client, escrow calldata, release/cancel
└── lib/
    ├── prisma.ts
    ├── auth-options.ts
    └── email.ts            # Resend email templates
```

---

## Contract state machine

```
DRAFT
  └─ receiver joins ──→ AWAITING_ESCROW
                               └─ grant giver funds ──→ FUNDED
                                                            └─ receiver uploads proof ──→ PROOF_SUBMITTED
                                                                                                └─ AI YES      ──→ VERIFIED ──→ COMPLETED
                                                                                                └─ AI UNCERTAIN ──→ PENDING_REVIEW
                                                                                                │                       └─ investor APPROVE ──→ VERIFIED ──→ COMPLETED
                                                                                                │                       └─ investor REJECT  ──→ REJECTED
                                                                                                └─ AI NO       ──→ REJECTED
                                                                                                                        └─ resubmit ──→ FUNDED (loop)
                                                            └─ deadline passed (cron) ──→ EXPIRED
```

---

## Key design decisions

**Why EVM smart contracts?**  
XRPL EVM Sidechain gives us Solidity smart contracts with full programmability, while staying in the XRPL ecosystem and using RLUSD as the native stablecoin.

**Why MetaMask?**  
The platform never holds user private keys. MetaMask signs the `approve` + `fundMilestone` transactions on the user's device. The platform wallet only calls `releaseMilestone` / `cancelMilestone` server-side after AI verification.

**Why PENDING_REVIEW?**  
When the AI confidence is below a threshold, instead of making a wrong call, it escalates to the grant giver for a manual decision. This is the Tier 2 governance model.

**Why email/password auth?**  
Straightforward onboarding without requiring a wallet upfront. Users connect MetaMask separately once they're ready to fund or receive.

**Email verification**  
All new accounts require email verification before they can sign in. Tokens expire in 24 hours; resend is rate-limited to once per 60 seconds server-side.
