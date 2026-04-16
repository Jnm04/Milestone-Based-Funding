<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# cascrow — Agent Rules

## Product
The product is called **cascrow**. The repo folder is `milestonefund` — use `cascrow` in any user-facing text.

## Dual-Chain Architecture — DO NOT CONFUSE THE TWO

| Chain | Purpose | Env |
|-------|---------|-----|
| XRPL EVM Sidechain (Chain ID 1449000) | Escrow (RLUSD ERC-20 smart contract) | Testnet currently |
| Native XRP Ledger | NFT certificates + audit trail memos | **Mainnet** always |

- Escrow code lives in `src/services/evm/` and uses **ethers.js**
- NFT/audit code lives in `src/services/xrpl/` and uses **xrpl.js HTTP JSON-RPC**
- Never mix these two chains. EscrowCreate/Finish/Cancel are EVM smart contract calls, not XRPL native transactions.

## IS_MAINNET
- `src/lib/config.ts` exports `IS_MAINNET` — defaults **true** unless `XRPL_NETWORK=testnet`
- Used to select XRPL RPC endpoint and explorer URLs
- Always use this flag instead of hardcoding `"mainnet"` or `"testnet"` strings

## MetaMask Flow (CRITICAL)
- Escrow funding is a **two-step MetaMask flow**: ERC-20 `approve` first, then `createMilestone`
- **Never add `simulateCall` (eth_call) between approve and fund** — it causes invisible hangs on slow testnet RPC
- After `waitForReceipt(approveTxHash)`, call `sendTx` directly for the fund step
- Code in `src/app/contract/[id]/contract-actions.tsx`

## XRPL Audit Writes
- `src/services/xrpl/audit-xrpl.service.ts` uses **AccountSet** (not Payment-to-self)
- Payment-to-self is rejected as `temREDUNDANT` on XRPL — do not change this
- The service **never throws** — returns `null` on failure (silent fail is intentional)
- Has retry logic for sequence conflicts (two events within ~3s)
- Requires `XRPL_PLATFORM_SEED` env var and funded wallet on the target network

## AI Verification
- `src/services/ai/verifier.service.ts` runs **5 models in parallel** via `Promise.allSettled`
- Models: Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Cerebras/Qwen3
- **3/5 YES = approved**. Do not change the threshold without discussing.
- API usage is tracked in the `ApiUsage` DB table (non-fatal if it fails)
- **Soft failure**: if < 3 models respond, returns `confidence: 65` + `decision: "NO"` → triggers PENDING_REVIEW tier in `verify/route.ts` instead of throwing a 500
- Three-tier confidence logic in `verify/route.ts`: `< 60` → REJECTED, `60–85` → PENDING_REVIEW, `> 85` + YES → VERIFIED

## File Storage
- All uploads (PDFs, NFT SVGs) go to **Vercel Blob** via `BLOB_READ_WRITE_TOKEN`
- No S3, no local disk

## Auth
- **NextAuth credentials** (email + password). No wallet-based sign-in.
- Wallet address is optional, stored in user profile, used for display only
- Session type extended in `src/types/next-auth.d.ts`

## Database
- Always run `npx prisma generate` after schema changes
- Always create a migration: `npx prisma migrate dev --name <description>`
- The `AuditLog` model has both `evmTxHash` and `xrplTxHash` fields — both are optional

## Styling
- Dark copper/amber design system: primary `#C4704B`, text `#EDE6DD`, muted `#A89B8C`, gold `#D4B896`
- Background: `#171311`
- Use inline `style={{}}` for brand colors (not Tailwind color classes)
- Rounded corners: `rounded-2xl` standard, `rounded-full` for pills

## Rate Limiting
- `src/lib/rate-limit.ts` exports `checkRateLimit(key, max, windowMs)` — **in-memory, per-instance only**
- For the `/api/verify` route: rate limiting is **DB-backed** (counts recent `Proof` records via Prisma) — cross-instance safe in serverless. Do not revert to in-memory for this route.
- For all other routes: in-memory rate limiting is acceptable

## API Contracts
- `GET /api/contracts` supports `?status=FUNDED&search=keyword` filter params
- `PATCH /api/contracts/[id]` — edit `milestone`, `amountUSD`, `cancelAfter` while contract is `DRAFT` (investor only, startup not yet accepted)
- `DELETE /api/proof/[proofId]` — startup can delete their own proof if `aiDecision` is null; resets milestone to `FUNDED`
- `GET /api/user/export` — GDPR data export (JSON download, strips passwordHash/tokens)
- `POST /api/user/delete` — GDPR soft anonymization (requires `{ confirmEmail }` body); cancels DRAFT/AWAITING_ESCROW contracts; anonymizes user row, does NOT delete it (preserves FK references)
- `GET /api/auth/check-verified` — **public endpoint** (no session required), looks up by `?email=`, IP rate-limited (20/min); used for signup polling

## Env Validation
- `src/lib/env-validation.ts` runs at server startup (imported in `src/app/layout.tsx`)
- Throws on missing `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS`, `NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS`
- Warns (does not throw) for missing AI/blockchain keys

## ThirdWeb RPC
- The XRPL EVM Testnet RPC (`https://rpc.testnet.xrplevm.org`) is hosted by **ThirdWeb**
- Occasional "We are not able to process your request at this time" errors are ThirdWeb outages — not a code bug
- `extractError()` in `contract-actions.tsx` detects ThirdWeb error strings and replaces them with a user-friendly message

## Internal Admin
- `/internal/*` routes are for admin use only — always guard with `INTERNAL_API_SECRET` header check
- Do not expose internal endpoints publicly
- All internal auth comparisons use `crypto.timingSafeEqual` (constant-time) — do not use `===` for secret comparison

## Security Headers
- `next.config.ts` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` on all routes via `headers()`
- CSP is handled separately in middleware
- Do not remove or weaken these headers

## Error Handling
- Never return raw `err.message` in API responses — log it server-side, return a generic message to the client
- Pattern: `console.error("[route]", err); return NextResponse.json({ error: "..." }, { status: 500 })`
- `/api/health` returns generic `"Database check failed"` / `"XRPL check failed"` strings — not raw DB errors

## EVM Explorer
- **No stable public explorer** exists for XRPL EVM Testnet
- EVM tx hashes are shown as plain grey `<span>` text — do not add links to them
- XRPL mainnet tx hashes link to `https://xrpscan.com/tx/<hash>`
