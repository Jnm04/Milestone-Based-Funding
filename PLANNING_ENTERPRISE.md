# cascrow — Enterprise Attestation Mode (Phase 6)

> **Last updated:** 2026-04-20
> **Status:** Planning — not yet started
> See [PLANNING.md](PLANNING.md) for the main feature roadmap (Phases 1–5).

---

## Background & Motivation

The current escrow product (ESCROW mode) requires two parties (investor + startup) and involves real money movement. This creates regulatory friction: financial licensing, AML/KYC requirements, fiat on-ramping.

**Enterprise Attestation mode** (ATTESTATION mode) removes money entirely. No escrow, no RLUSD. Instead:
- A company defines goals/KPIs upfront
- At the verification date, AI fetches live data from pre-defined sources and evaluates whether the goal was met
- The result (commitment + evidence hash + AI verdict) is written permanently to the blockchain
- Primary use cases: internal KPI accountability, CSRD/ESG regulatory compliance, group-wide license/quota tracking, board-level goal transparency

**Regulatory position:** No financial instrument, no escrow, no custody of funds. Just data + AI + blockchain attestation. No financial license needed. Selling a SaaS product, not a financial service.

**Market driver:** EU CSRD (Corporate Sustainability Reporting Directive) mandates verifiable ESG reporting for ~50,000 companies from 2024-2026. Companies need an audit trail that auditors can independently verify. cascrow can be that trail.

**Why AI+Blockchain together is the right angle:**
- Blockchain alone = immutable storage, but anyone could upload false data
- AI alone = smart analysis, but no tamper-proof record
- Together = AI certifies what it saw, blockchain proves the certification happened and wasn't altered

**Competitive landscape:** No direct competitor offers both AI-powered evidence evaluation AND on-chain attestation for corporate KPIs. SAP, Oracle, Workday track the data but don't attest it. Chainlink/oracles attest on-chain data but don't evaluate unstructured evidence. cascrow occupies a unique gap.

---

## Product Architecture

### Two modes, one platform

```
Contract.mode = "ESCROW" | "ATTESTATION"
```

Everything built so far remains unchanged for ESCROW mode. ATTESTATION mode reuses:
- Contract / Milestone data model
- AI verification service (5-model vote)
- Blockchain audit trail (XRPL)
- Reputation system
- Email notifications
- Dashboard UI structure

ATTESTATION mode removes:
- EVM escrow (no `createMilestone`, `releaseMilestone`, `cancelMilestone` calls)
- RLUSD funding step
- MetaMask / wallet requirement
- `amountUSD` becomes optional (or repurposed as a "tracked value" field)

ATTESTATION mode adds:
- Data Source Connectors (see below)
- Single-company flow (no investor counterpart required)
- Optional auditor role (read-only verifier, not a funder)
- Recurring schedule option (verify quarterly, monthly, annually)
- Attestation Certificate (different from NFT cert — a formal compliance document)

---

## Parties in Attestation Mode

| Role | Who | What they do |
|------|-----|-------------|
| **Owner** | Company / team lead / CFO | Defines goals, manages the attestation |
| **Auditor** (optional) | External auditor, board member, regulator | Read-only access to results; can be notified on completion |
| **No counterpart required** | — | Unlike ESCROW, no startup/investor pairing needed |

A company can create and run an attestation completely alone. The auditor role is purely observational.

---

## Data Source Connectors — The Core Differentiator

This is what makes ATTESTATION mode much stronger than file uploads. When defining a milestone, the company specifies **where the data will come from**:

| Connector Type | Examples | How it works |
|---------------|---------|-------------|
| `URL_SCRAPE` | Public annual report page, company website | Platform fetches the URL at verification time, AI reads the HTML/text |
| `REST_API` | Stripe revenue API, Google Analytics, Salesforce | Company provides endpoint + API key (stored encrypted); platform calls it at verification time |
| `FILE_UPLOAD` | SAP export CSV, Excel, PDF report | Traditional upload, but hash stored on-chain for tamper evidence |
| `MANUAL_REVIEW` | Board approval, auditor sign-off | Human confirms via dashboard button — creates an on-chain record |
| `RSS_OR_FEED` | Public press releases, regulatory filings | Platform monitors and fetches at verification time |

**Key principle:** The data source is defined **before** the verification date. The company cannot change it after committing. At verification time, the platform fetches the source independently — the company has no opportunity to manipulate what the AI sees.

This is what makes it audit-grade. Screenshots are worthless. A pre-committed data source that the platform fetches autonomously is not.

---

## Example Use Cases

### 1. Revenue Target Attestation
- **Goal:** "Q2 revenue ≥ €5M"
- **Data source:** `REST_API` → Stripe `/v1/reporting/report_runs` endpoint
- **Verification:** Platform calls Stripe API, AI extracts total revenue for Q2, compares to target
- **On-chain record:** Commitment hash + Stripe response hash + AI verdict

### 2. ESG / CSRD Compliance Milestone
- **Goal:** "Reduce Scope 2 emissions by 15% vs 2024 baseline by Dec 2025"
- **Data source:** `FILE_UPLOAD` → Annual sustainability PDF (uploaded to Vercel Blob)
- **Secondary check:** `URL_SCRAPE` → company's public ESG page for cross-reference
- **Verification:** AI reads the PDF, extracts the emissions data, verifies the reduction claim
- **On-chain record:** PDF hash + AI assessment + blockchain timestamp

### 3. License / Quota Compliance (e.g., software licenses across subsidiaries)
- **Goal:** "All 12 European subsidiaries have valid ISO 27001 certifications"
- **Data source:** `URL_SCRAPE` × 12 → each subsidiary's public certificate page on the ISO registry
- **Verification:** AI scrapes all 12 pages, confirms certificate validity and expiry dates
- **On-chain record:** Each page's content hash + AI confirmation

### 4. Recurring KPI Dashboard (monthly)
- **Goal:** Monthly NPS score ≥ 60
- **Data source:** `REST_API` → Typeform or internal NPS API
- **Schedule:** Monthly, recurring (not one-off)
- **Verification:** Platform calls API on the 1st of each month, AI assesses, writes to chain
- **On-chain record:** Monthly series of attestation entries

---

## DB Schema Changes

### Contract model additions
```prisma
mode                    String   @default("ESCROW")  // "ESCROW" | "ATTESTATION"
auditorEmail            String?  // optional: email of auditor/observer to CC on results
```

### Milestone model additions
```prisma
// Data source for ATTESTATION mode
dataSourceType          String?  // "URL_SCRAPE" | "REST_API" | "FILE_UPLOAD" | "MANUAL_REVIEW"
dataSourceUrl           String?  // URL to scrape or API endpoint
dataSourceApiKeyEnc     String?  @db.Text  // encrypted API key (if REST_API)
dataSourceApiKeyHint    String?  // last 4 chars, shown in UI for confirmation
dataSourceConfig        Json?    // additional config (HTTP method, headers template, response path)
dataSourceLockedAt      DateTime? // when the source was locked (cannot be changed after this)

// Attestation results (replaces proof upload)
attestationFetchedAt    DateTime? // when platform fetched the data source
attestationFetchedHash  String?   // SHA-256 of the raw fetched response
attestationFetchedBlob  String?   // Vercel Blob URL of the raw fetched content (for audit)
attestationCertUrl      String?   // URL of generated attestation certificate PDF

// Recurring schedule
scheduleType            String?   // "ONE_OFF" | "MONTHLY" | "QUARTERLY" | "ANNUAL"
scheduleNextRun         DateTime?
schedulePreviousRun     DateTime?
```

### New model: AttestationEntry (for recurring schedules)
```prisma
model AttestationEntry {
  id              String   @id @default(cuid())
  milestoneId     String
  period          String   // e.g. "2026-Q1", "2026-04"
  fetchedAt       DateTime
  fetchedHash     String
  fetchedBlobUrl  String?
  aiVerdict       String   // "YES" | "NO" | "INCONCLUSIVE"
  aiReasoning     String   @db.Text
  xrplTxHash      String?
  evmTxHash       String?
  certUrl         String?
  createdAt       DateTime @default(now())

  @@index([milestoneId])
}
```

---

## New API Routes

| Route | Method | Who | What |
|-------|--------|-----|------|
| `POST /api/contracts` | POST | Already exists | Add `mode` field to existing handler |
| `GET /api/contracts/[id]/attestation/source` | GET | Owner | Returns current data source config |
| `POST /api/contracts/[id]/milestones/[milestoneId]/attestation/lock-source` | POST | Owner | Locks the data source so it cannot be changed |
| `POST /api/contracts/[id]/milestones/[milestoneId]/attestation/run` | POST | Platform/cron | Fetches data source, runs AI verification, writes to chain |
| `GET /api/contracts/[id]/milestones/[milestoneId]/attestation/history` | GET | Owner + Auditor | Returns all `AttestationEntry` records |
| `POST /api/attestation/test-source` | POST | Owner | Dry-run: fetches data source once and returns preview (does NOT write to chain, does NOT count as official run) |

---

## AI-Powered Setup Tool ("Goal Wizard")

When creating an attestation, the company can describe their goal in plain language and AI structures it:

> **Input:** "We want to prove that our carbon emissions went down by 20% compared to last year. We publish a sustainability report every December."

> **Output:**
> - Milestone title: "Scope 1+2 Carbon Emissions Reduction — 2026"
> - Goal description: "Total Scope 1 and Scope 2 CO₂-equivalent emissions ≤ 80% of 2025 baseline"
> - Suggested data source: `FILE_UPLOAD` (sustainability report PDF)
> - Suggested secondary check: `URL_SCRAPE` → company's public ESG page
> - Suggested deadline: December 31, 2026
> - Verification criteria: AI will look for: total emissions figure, comparison to prior year, third-party auditor signature if present

**API:** `POST /api/attestation/wizard`
```json
{ "description": "plain language goal description (min 20, max 2000 chars)" }
```

**Response:**
```json
{
  "title": "string",
  "goalDescription": "string",
  "suggestedDataSourceType": "FILE_UPLOAD | URL_SCRAPE | REST_API",
  "suggestedDataSourceHint": "string (human-readable explanation of what to provide)",
  "suggestedDeadline": "ISO date string",
  "verificationCriteria": ["string", "string"]
}
```

Rate limit: `attestation-wizard:{userId}` — 10/hour.
Model: Claude Haiku (same pattern as Feature A — AI Contract Drafting).

---

## Attestation Certificate

Different from the NFT completion cert. The attestation certificate is a formal document:

- Header: "Corporate KPI Attestation Certificate"
- Company name, goal title, verification date
- Data source used (type + URL/hint, not the API key)
- AI verdict (VERIFIED / NOT MET / INCONCLUSIVE)
- AI reasoning summary (2-3 sentences)
- SHA-256 hash of the fetched evidence
- XRPL transaction hash (link to xrpscan.com)
- cascrow platform signature
- QR code linking to the public verification page

Generated as PDF via existing Vercel Blob + SVG patterns (same as `src/services/xrpl/cert-image.service.ts`).
Also available as a shareable link (`/cert/attestation/[entryId]`) — public-facing, no login required.
Designed to be shared with regulators, board members, auditors.

---

## Proof of Concept Build Order

Build in this order to de-risk:

1. **DB schema** — add `mode` to `Contract`, data source fields to `Milestone`, new `AttestationEntry` model
2. **Contract creation** — extend `POST /api/contracts` to accept `mode: "ATTESTATION"`, skip escrow fields
3. **Data source config UI** — form in contract creation to define the source (no fetching yet)
4. **Source lock** — endpoint to lock the source; after locking, no edits allowed
5. **Test-source endpoint** — dry-run fetch with AI preview (builds confidence before committing)
6. **Run attestation** — fetch source, hash it, AI evaluate, write to XRPL, create `AttestationEntry`
7. **Attestation certificate** — PDF + public `/cert/attestation/[id]` page
8. **Goal Wizard** — AI-powered setup from plain language description
9. **Auditor role** — add auditor email to contract, CC on results
10. **Recurring schedules** — cron job triggers `run` on schedule; series of `AttestationEntry` records

**Estimated effort:** 5-7 days for steps 1-6 (core flow), 2-3 days for steps 7-10 (polish + wizard).

---

## Landing Page Integration

The enterprise section is already live (teaser, "Talk to our team" CTA). Once ATTESTATION mode is built:

- Add "Try Attestation Mode" button alongside the existing escrow flow on the landing page
- New `/attestation` or `/enterprise` marketing page with full feature breakdown
- Update the features section to show both modes side by side
- Add a live counter: "X KPI attestations on-chain" (from `AttestationEntry` count)

---

## Phase 2 Innovation Features

These features are not required for the MVP (steps 1–10 above) but are high-value differentiators to build after the core flow is live.

---

### Feature I — Regulatory Mapping (CSRD / ESRS / GRI Auto-Tagging)

**What:** When creating a goal, AI automatically maps it to the relevant regulatory framework articles. The mapping is stored on the attestation entry and printed on the certificate.

**Why it matters:** EU CSRD mandates that ~50,000 companies report against specific ESRS articles (E1-4, S1-8, G1-2, etc.). Today their compliance teams map manually — error-prone and time-consuming. cascrow does it automatically and the on-chain attestation proves it.

**How it works:**
1. User describes goal in the Goal Wizard (or manually)
2. AI call: `POST /api/attestation/wizard` (extend existing) — add `regulatoryMapping` to response
3. Response includes: `[{ framework: "CSRD", article: "ESRS E1-4", clause: "§12(b)", confidence: 0.91 }]`
4. Stored in `AttestationEntry.regulatoryMapping` (JSON field)
5. Printed on Attestation Certificate under "Regulatory Frameworks Addressed"
6. Filterable in the Board Report Pack (see below)

**DB addition:**
```prisma
// AttestationEntry
regulatoryMapping   Json?   // [{ framework, article, clause, confidence }]
```

**Supported frameworks (MVP):** CSRD/ESRS, GRI Standards, UN SDGs
**Competitive angle:** No existing tool auto-maps + attests + stores on-chain. This alone is a procurement reason for large EU corporates.

---

### Feature II — Early Warning / Trend Monitoring

**What:** For recurring attestations (monthly/quarterly), the platform runs lightweight "pulse checks" between official verification dates. If the data is trending toward a miss, the owner is notified in advance.

**Why it matters:** Attestation is not just about proving a result — it's about not being surprised. A CFO who gets a warning in month 8 of 12 can course-correct. A CFO who only finds out at month 12 cannot.

**How it works:**
1. For milestones with `scheduleType = "MONTHLY" | "QUARTERLY"`, a separate cron job runs a "pulse check" on a configurable interval (e.g., mid-period)
2. Pulse check: fetch data source → AI extracts current value → compare to target trajectory
3. If AI predicts `< 70% probability of meeting target`: send `EARLY_WARNING` email + Telegram notification
4. Pulse check does NOT write to chain (no cost, no official record)
5. If owner acts and improves: no record that a warning was issued (privacy-preserving)

**New DB fields:**
```prisma
// Milestone
pulseCheckEnabled   Boolean  @default(false)
pulseCheckInterval  String?  // "MID_PERIOD" | "WEEKLY" | "BIWEEKLY"
lastPulseCheckAt    DateTime?
lastPulseCheckRisk  String?  // "ON_TRACK" | "AT_RISK" | "LIKELY_MISS"
```

**New API:** `POST /api/cron/pulse-checks` — Vercel cron, runs weekly, finds at-risk recurring milestones

---

### Feature III — Board Report Pack (One-Click PDF)

**What:** A company can generate a single, board-ready PDF containing all attestations for a given year/period, organized by framework, with trend charts and an executive summary.

**Why it matters:** CFOs and sustainability officers need to present KPI performance to boards and regulators. Today this means manually assembling data from multiple sources. cascrow generates it in one click from verified, on-chain data.

**Contents of the report:**
- Executive Summary (AI-generated, 2-3 paragraphs)
- Table: All attestations in period — Goal | Verdict | Verification Date | XRPL TX
- By regulatory framework: CSRD, GRI, SDG sections with relevant attestations grouped
- Trend charts for recurring KPIs (simple SVG sparklines)
- Appendix: individual attestation certificate links (QR codes)
- Footer: "All data verified by cascrow AI and recorded on XRP Ledger. Report generated [date]. cascrow.com"

**How it works:**
- `POST /api/reports/board-pack` — accepts `{ contractId, period: "2026", frameworks: ["CSRD"] }`
- Aggregates all `AttestationEntry` records for that contract in the period
- AI generates executive summary from the results
- PDF generated server-side (same Vercel Blob pattern as existing cert-image.service.ts)
- Returns Blob URL, stored in `Report` DB model

**New model:**
```prisma
model Report {
  id          String   @id @default(cuid())
  contractId  String
  period      String   // "2026", "2026-Q1", etc.
  type        String   // "BOARD_PACK"
  blobUrl     String
  generatedAt DateTime @default(now())
  @@index([contractId])
}
```

---

### Feature IV — Independent Auditor Re-Run Portal

**What:** External auditors (KPMG, Deloitte, PWC) can request an independent re-verification of any attestation. They authenticate via a one-time token, provide their own data source credentials, and the platform runs the same AI verification — creating a second, auditor-triggered `AttestationEntry` linked to the original.

**Why it matters:** The company's attestation proves what *they* claim. An auditor re-run proves what an *independent party* verified. This combination is what Big 4 firms need to sign off on CSRD reports. cascrow becomes the technical layer beneath the audit engagement.

**How it works:**
1. Company owner issues an "auditor access token" from dashboard — `POST /api/contracts/[id]/auditor-invite`
2. Token sent to auditor email — one-time, 7-day expiry
3. Auditor visits `/audit/[token]` — read-only view of all attestation configs (no API keys visible)
4. For any attestation, auditor can click "Re-Run with My Credentials" — provides their own API key
5. Platform runs identical verification: fetch → hash → AI → XRPL write
6. New `AttestationEntry` created with `type: "AUDITOR_RERUN"`, linked to original entry
7. Both entries shown on the public certificate page side by side

**DB addition:**
```prisma
// AttestationEntry
type          String  @default("PLATFORM")  // "PLATFORM" | "AUDITOR_RERUN"
linkedEntryId String?  // for AUDITOR_RERUN: points to original PLATFORM entry
auditorEmail  String?
```

**Competitive angle:** No other platform lets a Big 4 auditor independently re-execute a KPI verification and write the result to blockchain. This is the feature that converts cascrow from "nice tool" to "part of the official audit workflow."

---

### Feature V — Opt-In Peer Benchmarking

**What:** Companies that opt in can see how their verified KPIs compare to anonymized peers in the same industry/sector. Shown as percentile ranks, not raw data. Example: "Your Scope 2 reduction of 15% is in the top 28% of verified companies in this sector."

**Why it matters:** Boards and investors ask "how are we doing compared to peers?" This is currently impossible to answer with verified data. cascrow has the verified data — and can surface it responsibly.

**How it works:**
1. Company opts in per milestone at creation time (`benchmarkOptIn: Boolean @default(false)`)
2. Verified `AttestationEntry` records with `benchmarkOptIn=true` feed an anonymized aggregate
3. No raw data shared — only percentile rank computed server-side, never exposed in DB
4. Shown in dashboard after attestation: "Industry Percentile: Top 28%"
5. Leaderboard: public, anonymized "Top ESG Performers This Quarter" — drives organic marketing

**DB addition:**
```prisma
// Milestone
benchmarkOptIn  Boolean  @default(false)
benchmarkSector String?  // "MANUFACTURING" | "TECH" | "FINANCE" | etc.
```

**Privacy:** Raw values never stored in a benchmark table. Only pre-aggregated percentiles computed on query. Companies can opt out at any time (removes future entries, not historical).

---

## Open Questions / Decisions Needed

| Question | Options | Status |
|----------|---------|--------|
| How to handle API key storage? | Encrypt at rest with AES-256 using `ATTESTATION_KEY_SECRET` env var; never expose to client | Decided |
| Public cert page — what's visible? | Verdict, reasoning, source type, evidence hash, XRPL link — NOT the raw fetched data | Decided |
| Pricing model | Per attestation run (€10-50/run) or subscription (€200-2000/month) | Open |
| Data residency for EU companies | Vercel EU region for fetched blobs; XRPL mainnet (no choice) | Open |
| What happens if source fetch fails at verification time? | Retry 3× then mark `INCONCLUSIVE`, notify owner, do NOT mark as failed | Decided |
| CSRD-specific fields? | Could add `csrdArticle`, `reportingStandard` (GRI/ESRS/TCFD) — probably Phase 2 | Open |
| Multi-source milestones? | One primary source + one secondary optional cross-check — enough for MVP | Decided (MVP: one primary) |

---

## Key Files

| Step | Files to create/modify |
|------|----------------------|
| Schema | `prisma/schema.prisma` |
| Contract creation | `src/app/api/contracts/route.ts` (extend POST) |
| Data source routes | new `src/app/api/contracts/[id]/milestones/[milestoneId]/attestation/` |
| Goal Wizard | new `src/app/api/attestation/wizard/route.ts` |
| Test source | new `src/app/api/attestation/test-source/route.ts` |
| Run attestation | new `src/services/attestation/runner.service.ts` (fetch + AI + chain write) |
| Fetch adapters | new `src/services/attestation/fetchers/url-scrape.ts`, `rest-api.ts`, `file-upload.ts` |
| Certificate | new `src/services/attestation/cert.service.ts` (PDF generation) |
| Public cert page | new `src/app/cert/attestation/[id]/page.tsx` |
| UI — contract creation | `src/components/contract-form.tsx` (add mode toggle + data source wizard) |
| UI — dashboard | `src/app/dashboard/investor/page.tsx` (show ATTESTATION contracts separately or tagged) |
| UI — contract detail | `src/app/contract/[id]/contract-actions.tsx` (ATTESTATION-specific blocks) |
| Cron | `src/app/api/cron/` (new route for scheduled attestation runs) |
| Encryption helper | new `src/lib/encrypt.ts` (AES-256 for API keys) |
| **Phase 2** | |
| Regulatory mapping | extend `src/app/api/attestation/wizard/route.ts` + `AttestationEntry` schema |
| Pulse checks | new `src/app/api/cron/pulse-checks/route.ts` |
| Board report pack | new `src/app/api/reports/board-pack/route.ts` + `src/services/attestation/report.service.ts` |
| Auditor portal | new `src/app/api/contracts/[id]/auditor-invite/route.ts` + `src/app/audit/[token]/page.tsx` |
| Peer benchmarking | new `src/app/api/attestation/benchmark/route.ts` (server-side percentile only, no raw data) |
