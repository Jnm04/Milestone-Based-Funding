# MilestoneFund

AI-powered RLUSD escrow agent on the XRP Ledger.
Investors lock RLUSD in a crypto-condition escrow; funds release automatically when an AI agent verifies the startup has met the agreed milestone.

Built on **XLS-85** (IOU Escrow, live Feb 2026) · **Claude AI** · **Xumm** wallet signing · **Next.js 15**

---

## How it works

```
Investor creates contract  →  Startup accepts invite
        ↓
Investor signs EscrowCreate via Xumm (RLUSD locked on-chain)
        ↓
Startup uploads PDF proof of milestone completion
        ↓
Claude AI reads the PDF and returns YES or NO
        ↓
  YES → Investor signs EscrowFinish → RLUSD sent to startup
  NO  → Startup can resubmit (or cancel after deadline)
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui |
| Wallet | Xumm SDK (QR sign requests) |
| Blockchain | XRPL Testnet, xrpl.js v4, XLS-85 IOU Escrow |
| Stablecoin | RLUSD (`rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`) |
| AI | Claude `claude-sonnet-4-6` via Anthropic SDK |
| Database | PostgreSQL + Prisma 7 |
| File storage | Vercel Blob |

---

## Local development

### 1. Prerequisites

- Node.js 20+
- PostgreSQL (local or hosted)
- [Xumm developer account](https://apps.xumm.dev) — create an app, get API key + secret
- Anthropic API key (optional — falls back to mock verifier)
- Vercel Blob token (optional — or replace with local file handling)

### 2. Install

```bash
cd milestonefund
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required for full functionality:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `XUMM_API_KEY` | Xumm app API key |
| `XUMM_API_SECRET` | Xumm app API secret |
| `NEXTAUTH_SECRET` | Random secret (run `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Your app URL (e.g. `http://localhost:3000`) |

Optional (fall back to mocks if not set):

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Real Claude AI verification |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for PDF storage |

### 4. Database setup

```bash
# Apply migrations
npm run db:migrate

# (Optional) Pre-populate demo contract
npm run db:seed
```

### 5. Run

```bash
npm run dev
# → http://localhost:3000
```

---

## Vercel deployment

### One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment variables on Vercel

Set these in the Vercel dashboard under **Settings → Environment Variables**:

```
DATABASE_URL
XUMM_API_KEY
XUMM_API_SECRET
ANTHROPIC_API_KEY
BLOB_READ_WRITE_TOKEN
NEXTAUTH_SECRET
NEXTAUTH_URL          # your Vercel URL, e.g. https://milestonefund.vercel.app
```

After deploying, run migrations:

```bash
# From local (pointing at prod DB)
DATABASE_URL=<prod-url> npm run db:migrate
```

And set the **Xumm webhook URL** in your Xumm app settings:
```
https://your-app.vercel.app/api/escrow/webhook
```

---

## Demo flow (5-minute live demo)

### Setup (before demo)

```bash
npm run db:seed
# Note the Contract ID printed — open it in the browser
```

### Demo script

**Step 1 — Investor creates contract** (already seeded)
- Open `/contract/<id>` as investor wallet
- Show: milestone text, RLUSD amount, deadline

**Step 2 — Fund Escrow**
- Click "Fund Escrow via Xumm"
- Scan QR in Xumm mobile app and sign
- Page reloads to FUNDED status

**Step 3 — Startup uploads proof**
- Switch to startup wallet (join via invite link)
- Upload a PDF with detailed milestone evidence
- AI verification runs automatically

**Step 4 — AI decision**
- Show AI verdict (YES/NO), confidence score, reasoning
- If YES: investor clicks "Release Funds via Xumm"

**Step 5 — EscrowFinish**
- Investor signs in Xumm → RLUSD sent to startup
- Check XRPL Testnet explorer to confirm the transaction

### Testnet explorer
- Transactions: `https://testnet.xrpl.org/accounts/<address>`

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # Xumm wallet sign-in
│   │   ├── contracts/     # Create, join, resubmit
│   │   ├── escrow/        # Create, finish, cancel, webhook
│   │   ├── proof/         # PDF upload + text extraction
│   │   └── verify/        # AI milestone verification
│   ├── contract/[id]/     # Contract detail page
│   ├── dashboard/         # Investor + startup dashboards
│   └── page.tsx           # Landing page
├── components/
│   ├── contract-form.tsx
│   ├── proof-upload.tsx
│   ├── escrow-status.tsx
│   ├── ai-result.tsx
│   └── wallet-connect.tsx
├── services/
│   ├── ai/               # Claude verifier + mock
│   ├── crypto/           # Crypto-condition generation
│   └── xrpl/             # Escrow TXs, Xumm, XRPL client
├── lib/
│   └── prisma.ts          # Prisma 7 + pg adapter singleton
└── types/
    └── index.ts

prisma/
├── schema.prisma
└── migrations/

scripts/
├── seed-demo.ts           # Pre-populate demo data
├── test-e2e-flow.ts       # Full flow test (no DB/Xumm)
├── test-xrpl.ts           # Live Testnet connectivity test
└── test-ai.ts             # AI verifier test
```

---

## Contract state machine

```
DRAFT
  └─ startup joins ──→ AWAITING_ESCROW
                              └─ investor funds ──→ FUNDED
                                                       └─ startup uploads ──→ PROOF_SUBMITTED
                                                                                    └─ AI YES ──→ VERIFIED ──→ COMPLETED
                                                                                    └─ AI NO  ──→ REJECTED
                                                                                                     └─ resubmit ──→ FUNDED (loop)
                                                                                                     └─ expired  ──→ EXPIRED
                                                       └─ deadline passed ──→ EXPIRED
```

---

## Key design decisions

**Why crypto-conditions?**
XRPL native escrow requires a `Condition`/`Fulfillment` pair (SHA-256 preimage). The AI verifier reveals the fulfillment only on YES — this is the cryptographic gate that releases funds.

**Why Xumm for signing?**
We never hold private keys. Xumm signs transactions on the user's device. The app builds the unsigned TX and creates a sign request; Xumm handles the rest.

**Why mock mode?**
Setting `ANTHROPIC_API_KEY` is optional. Without it, the verifier falls back to a length-based mock (>100 chars → YES). This lets you run the full UI flow without an API key.

**XLS-85 (IOU Escrow)**
Live on XRPL Mainnet/Testnet since February 2026. Allows RLUSD (and any IOU) as the escrow amount, not just XRP. The `Amount` field uses the IOU object format: `{ currency, issuer, value }`.

---

## Running tests

```bash
# Full E2E logic test (no external services needed)
npm run test:e2e

# Live Testnet connectivity
npm run test:xrpl

# AI verifier (mock mode)
npm run test:ai
```
