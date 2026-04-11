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

## Internal Admin
- `/internal/*` routes are for admin use only — always guard with `INTERNAL_API_SECRET` header check
- Do not expose internal endpoints publicly

## EVM Explorer
- **No stable public explorer** exists for XRPL EVM Testnet
- EVM tx hashes are shown as plain grey `<span>` text — do not add links to them
- XRPL mainnet tx hashes link to `https://xrpscan.com/tx/<hash>`
