# cascrow — Enterprise Attestation Mode (Phase 6)

> **Last updated:** 2026-04-23
> **Status:** Phase 2 complete (2026-04-23). Phase 3 planned — see below.
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

---

## Phase 3 — Differentiating Features (Unique Market Position)

> **Status:** Planning — Phase 2 complete as of 2026-04-23
> These six features are what separates cascrow from every ESG/KPI tool on the market.
> None requires a full rewrite — each extends the existing attestation infrastructure.

---

### Feature VI — Predictive Miss Detection

**What:** Before a milestone misses its deadline, cascrow predicts it weeks in advance using trend data from pulse checks. No other attestation platform offers forecasting — only backward-looking verdicts.

**Why it's unique:** Every ESG tool tells you *after the fact* whether a goal was met. cascrow tells you *before* — with a confidence score and projected timeline.

**User-facing output example:**
> "Based on 8 pulse checks, this milestone is on a trajectory to **miss** the June 30 deadline.
> Predicted outcome: NO — 81% confidence. You have ~5 weeks to course-correct."

---

#### DB Changes

```prisma
// New model — stores every pulse check snapshot for trend analysis
model PulseCheckSnapshot {
  id           String   @id @default(cuid())
  milestoneId  String
  capturedAt   DateTime @default(now())
  risk         String   // "ON_TRACK" | "AT_RISK" | "LIKELY_MISS"
  rawValue     String?  // extracted metric value as a string (e.g. "€4.2M")
  targetValue  String?  // target at time of check (e.g. "€5M")
  confidence   Float    // 0.0–1.0 — AI confidence in the extracted value
  @@index([milestoneId, capturedAt])
}

// Milestone additions
predictedOutcome     String?  // "YES" | "NO" | "INCONCLUSIVE" — current projection
predictedConfidence  Float?   // 0.0–1.0
predictedUpdatedAt   DateTime?
```

---

#### New Service: `src/services/attestation/predictor.service.ts`

```typescript
export interface Prediction {
  predictedOutcome: "YES" | "NO" | "INCONCLUSIVE";
  confidence: number;        // 0.0–1.0
  weeksToDeadline: number;
  trendSlope: number;        // positive = improving, negative = worsening
  snapshotCount: number;
  lastRawValue: string | null;
}

export async function computePrediction(milestoneId: string): Promise<Prediction | null>
```

**Algorithm:**
1. Load all `PulseCheckSnapshot` records ordered by `capturedAt` (min 3 required, else return null)
2. Map `risk` to numeric score: ON_TRACK=1.0, AT_RISK=0.5, LIKELY_MISS=0.0
3. Run simple linear regression over (time_offset_days → risk_score) pairs
4. Project slope to deadline → predicted risk score at T=deadline
5. If projected score < 0.35 → `predictedOutcome = "NO"`, 0.35–0.65 → `"INCONCLUSIVE"`, >0.65 → `"YES"`
6. Confidence = R² of the regression × average `snapshot.confidence`
7. Save result to `Milestone.predictedOutcome + predictedConfidence + predictedUpdatedAt`
8. Return `Prediction`

**Called from:**
- End of `pulse-checks` cron after each snapshot is saved
- `GET /api/contracts/[id]/milestones/[milestoneId]/attestation/prediction` (on-demand)

---

#### Modified: Pulse Checks Cron (`src/app/api/cron/pulse-checks/route.ts`)

After each pulse check run, before updating `lastPulseCheckAt`:
1. Save `PulseCheckSnapshot` with extracted `rawValue` + `confidence`
2. Call `computePrediction(milestoneId)`
3. If prediction flips from ON_TRACK to LIKELY_MISS → send `sendPredictiveMissEmail()`
4. Update `Milestone.predictedOutcome + predictedConfidence + predictedUpdatedAt`

The AI prompt for pulse checks must be extended to also return:
```json
{
  "risk": "ON_TRACK" | "AT_RISK" | "LIKELY_MISS",
  "assessment": "string",
  "extractedValue": "€4.2M",   // NEW — current metric value
  "targetValue": "€5M",         // NEW — what the milestone requires
  "confidence": 0.82            // NEW — how confident AI is in the extraction
}
```

---

#### New Email: `sendPredictiveMissEmail`

Add to `src/lib/email.ts`:
```typescript
sendPredictiveMissEmail({
  to: string,
  milestoneTitle: string,
  contractId: string,
  predictedOutcome: "NO" | "INCONCLUSIVE",
  confidence: number,          // e.g. 0.81 → "81%"
  weeksToDeadline: number,
  lastRawValue: string | null,
  targetValue: string | null,
})
```

Email subject: `"⚠ Predictive Warning: "${milestoneTitle}" is trending to miss"`
Color: `#f59e0b` (amber) for AT_RISK, `#ef4444` (red) for LIKELY_MISS.
Note: "No blockchain record has been written — this is a private early-warning signal."

---

#### New API Route: `GET /api/contracts/[id]/milestones/[milestoneId]/attestation/prediction`

Auth: owner only.
Returns: `Prediction | { error: "insufficient_data", snapshotCount: number }`.
Used by the dashboard to show the "Predicted Outcome" card.

---

#### Cron Addition (`vercel.json`)

Pulse checks already run `0 7 * * 1` (Mondays at 7am). No additional cron needed — prediction runs inside the pulse-checks handler.

---

#### Key Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `PulseCheckSnapshot` model + `Milestone.predicted*` fields |
| `src/services/attestation/predictor.service.ts` | New — regression-based prediction |
| `src/app/api/cron/pulse-checks/route.ts` | Save snapshots + call predictor |
| `src/lib/email.ts` | Add `sendPredictiveMissEmail` |
| `src/app/api/contracts/[id]/milestones/[milestoneId]/attestation/prediction/route.ts` | New GET endpoint |

**Estimated effort:** 1.5 days

---

---

### Feature VII — Double Materiality Assessment Wizard

**What:** EU CSRD mandates a "double materiality assessment" — every reporting company must identify which ESG topics are material from both (a) a financial impact perspective and (b) an environmental/social impact perspective. Today this is done manually by consultants over weeks. cascrow automates it in minutes and links the output directly to attestation milestones.

**Why it's unique:** No SaaS tool automates CSRD double materiality. SAP Sustainability Footprint Manager is €200k/year and still requires consultants. cascrow does it AI-first for a fraction of the cost, and connects the assessment to live, blockchain-verified KPIs.

**User-facing output:** An interactive materiality matrix (scatter plot) where each ESG topic is plotted on two axes, color-coded by materiality threshold, with recommended ESRS articles and a "Create Attestation Milestone" button for each material topic.

---

#### DB Changes

```prisma
model MaterialityAssessment {
  id          String   @id @default(cuid())
  userId      String
  contractId  String?  // optional: link to existing attestation contract
  sector      String   // e.g. "MANUFACTURING", "TECH"
  answers     Json     // wizard Q&A: [{ question, answer }]
  matrix      Json     // [{ topic, financialScore, impactScore, material, esrsArticles, griStandards }]
  summary     String?  @db.Text  // AI-generated 2-paragraph executive summary
  status      String   @default("IN_PROGRESS")  // "IN_PROGRESS" | "COMPLETE"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([userId])
  @@index([contractId])
}
```

---

#### Wizard Question Set (12 questions, answered in 3 steps)

**Step 1 — Company Profile (4 questions):**
1. What sector does your company operate in? (dropdown: MANUFACTURING, TECH, FINANCE, ENERGY, HEALTHCARE, RETAIL, OTHER)
2. In which regions do you operate? (checkboxes: EU, North America, Asia-Pacific, Other)
3. How many employees does your company have? (dropdown: <50, 50–250, 250–1000, 1000–5000, >5000)
4. Does your company have a supply chain with significant environmental or labor impacts? (Yes / No / Partially)

**Step 2 — ESG Exposure (5 questions):**
5. Which environmental topics are most relevant to your business? (multi-select: Climate, Pollution, Water, Biodiversity, Circular Economy)
6. Does your business significantly affect any communities or workers (directly or through supply chain)? (scale 1–5)
7. How dependent is your revenue on fossil fuels or carbon-intensive activities? (scale 1–5)
8. Are any of your products or services subject to significant regulatory environmental requirements? (Yes/No + text)
9. Have any ESG topics caused financial risk (litigation, fines, stranded assets) in the last 3 years? (Yes/No + text)

**Step 3 — Stakeholder Concerns (3 questions):**
10. What ESG topics do your investors most frequently ask about? (free text, max 300 chars)
11. Have any ESG topics been raised by employees, customers, or civil society in the last 2 years? (free text)
12. Which regulatory reporting obligations apply to your company? (checkboxes: CSRD, TCFD, GRI, SEC ESG, None)

---

#### AI Processing: `POST /api/attestation/materiality/[id]/generate`

System prompt instructs Claude to:
1. Analyze 12 answers to produce 15–20 ESG topic scores
2. For each topic, output `{ topic, financialScore (0–5), impactScore (0–5), material (bool), esrsArticles: string[], griStandards: string[], rationale: string }`
3. `material = true` if financialScore ≥ 3 OR impactScore ≥ 3 (CSRD "or" threshold)
4. Generate a 2-paragraph executive summary of the materiality profile
5. Recommend priority attestation milestones for the top 5 material topics

Model: Claude Haiku. Max tokens: 2000. Rate limit: 3/hour per user.

**Example output item:**
```json
{
  "topic": "Scope 1+2 GHG Emissions",
  "financialScore": 4.2,
  "impactScore": 4.8,
  "material": true,
  "esrsArticles": ["ESRS E1-1", "ESRS E1-4", "ESRS E1-6"],
  "griStandards": ["GRI 305-1", "GRI 305-2"],
  "rationale": "High energy intensity and EU ETS exposure creates transition risk; Scope 2 reduction is both a financial and impact imperative."
}
```

---

#### API Routes

| Route | Method | What |
|-------|--------|------|
| `POST /api/attestation/materiality` | POST | Create new assessment, returns `{ id }` |
| `PUT /api/attestation/materiality/[id]/answers` | PUT | Save answers (can be called multiple times as user progresses) |
| `POST /api/attestation/materiality/[id]/generate` | POST | Trigger AI matrix generation |
| `GET /api/attestation/materiality/[id]` | GET | Get current state (for multi-step UI) |
| `GET /api/attestation/materiality` | GET | List all assessments for current user |

All routes: `getServerSession` auth, owner-only access.

---

#### New Pages

- `/enterprise/materiality` — landing + "Start New Assessment" button
- `/enterprise/materiality/[id]` — multi-step wizard (step 1→2→3→generating→results)
- `/enterprise/materiality/[id]/matrix` — interactive scatter plot + milestone creation CTAs

The matrix visualization: SVG-based scatter plot (no heavy charting library), quadrants labeled "Monitor", "Manage", "Prioritize", "Report", using the existing dark copper theme.

---

#### Key Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `MaterialityAssessment` model |
| `src/app/api/attestation/materiality/route.ts` | New — POST list + GET list |
| `src/app/api/attestation/materiality/[id]/route.ts` | New — GET, PUT answers |
| `src/app/api/attestation/materiality/[id]/generate/route.ts` | New — AI generation |
| `src/app/(enterprise)/enterprise/materiality/[id]/page.tsx` | New — wizard UI |
| `src/components/materiality-matrix.tsx` | New — SVG scatter plot component |

**Estimated effort:** 3 days

---

---

### Feature VIII — XBRL / iXBRL Regulatory Filing Export

**What:** Export board report data as machine-readable XBRL-tagged XML, the mandated format for submissions to ESMA (EU), SEC (US), and BaFin (Germany). Compliance teams can submit directly to regulators without re-entering data.

**Why it's unique:** CSRD requires iXBRL-tagged sustainability reports from 2026 onwards. No ESG attestation tool generates XBRL output. EY and KPMG charge €50k+ to do this manually per report. cascrow generates it automatically from verified attestation data.

**What XBRL is:** A structured XML format where each data point is tagged with a standardized concept from a regulatory taxonomy (e.g., `esrs:Scope1GHGEmissions` with unit `tCO2e` for period `2026-01-01/2026-12-31`).

---

#### Supported Taxonomies (MVP)

| Taxonomy | Regulator | Key concepts |
|----------|-----------|-------------|
| ESRS (CSRD) | ESMA | E1 climate, S1 workforce, G1 governance metrics |
| GRI Universal | GRI | 2-1 org profile, 3-1 material topics, disclosure items |
| TCFD | FSB | GOVERNANCE, STRATEGY, RISK_MANAGEMENT, METRICS |

MVP supports ESRS — the most urgent for EU companies. GRI and TCFD added in subsequent releases.

---

#### XBRL Output Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:esrs="https://xbrl.efrag.org/taxonomy/esrs/2024-10-29"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:xbrli="http://www.xbrl.org/2003/instance">

  <xbrli:context id="CTX_2026">
    <xbrli:entity>
      <xbrli:identifier scheme="http://standards.iso.org/iso/17442">
        {LEI_CODE}
      </xbrli:identifier>
    </xbrli:entity>
    <xbrli:period>
      <xbrli:startDate>2026-01-01</xbrli:startDate>
      <xbrli:endDate>2026-12-31</xbrli:endDate>
    </xbrli:period>
  </xbrli:context>

  <!-- One fact element per attested data point -->
  <esrs:E1-6_GrossScope1GHGEmissions contextRef="CTX_2026" unitRef="tCO2e" decimals="0">
    4200
  </esrs:E1-6_GrossScope1GHGEmissions>

  <!-- Attestation provenance — cascrow extension -->
  <cascrow:AttestationReference contextRef="CTX_2026">
    {xrplTxHash}
  </cascrow:AttestationReference>

</xbrl>
```

---

#### ESRS Concept Mapping Table (MVP — 20 core concepts)

Stored as a static lookup in `src/services/attestation/xbrl/esrs-concepts.ts`:

```typescript
export const ESRS_CONCEPTS: Record<string, XbrlConcept> = {
  "scope1_emissions":      { tag: "esrs:E1-6_GrossScope1GHGEmissions", unit: "tCO2e", dataType: "decimal" },
  "scope2_emissions":      { tag: "esrs:E1-6_GrossScope2GHGEmissions", unit: "tCO2e", dataType: "decimal" },
  "scope3_emissions":      { tag: "esrs:E1-6_GrossScope3GHGEmissions", unit: "tCO2e", dataType: "decimal" },
  "energy_consumption":    { tag: "esrs:E1-5_TotalEnergyConsumption", unit: "MWh", dataType: "decimal" },
  "renewable_energy_pct":  { tag: "esrs:E1-5_EnergyFromRenewables", unit: "pure", dataType: "decimal" },
  "water_consumption":     { tag: "esrs:E3-4_TotalWaterConsumption", unit: "m3", dataType: "decimal" },
  "headcount":             { tag: "esrs:S1-6_NumberOfEmployees", unit: "people", dataType: "integer" },
  "gender_pay_gap":        { tag: "esrs:S1-16_GenderPayGap", unit: "pure", dataType: "decimal" },
  "board_gender_diversity":{ tag: "esrs:G1-1_BoardGenderDiversity", unit: "pure", dataType: "decimal" },
  "corruption_incidents":  { tag: "esrs:G1-4_CorruptionIncidents", unit: "count", dataType: "integer" },
  // ... 10 more
};
```

---

#### New Service: `src/services/attestation/xbrl/xbrl.service.ts`

```typescript
interface XbrlGenerationOptions {
  contractId: string;
  period: string;         // "2026"
  taxonomy: "ESRS";
  companyName: string;
  leiCode?: string;       // Legal Entity Identifier (20-char alphanumeric)
  reportingCurrency?: string;  // default "EUR"
}

export async function generateXbrlReport(options: XbrlGenerationOptions): Promise<{
  xml: string;
  blobUrl: string;
  conceptsTagged: number;
  untaggedMilestones: string[];  // milestone titles that couldn't be mapped
}>
```

**Generation algorithm:**
1. Load all `AttestationEntry` records for the contract + period with `aiVerdict = "YES"`
2. For each entry, read `regulatoryMapping` field
3. Map each ESRS article in `regulatoryMapping` to a concept in `ESRS_CONCEPTS`
4. Extract the data point value: run a lightweight AI call to extract the number from `aiReasoning` (e.g., "Scope 1 emissions: 4,200 tCO2e" → 4200)
5. Build the XBRL XML document
6. Store to Vercel Blob: `reports/xbrl/{contractId}/{period}-esrs.xbrl`
7. Create `Report` record with `type: "XBRL_ESRS"`

---

#### New API Route: `POST /api/reports/xbrl`

```typescript
// Request body (Zod schema)
const xbrlSchema = z.object({
  contractId: z.string().min(1).max(50),
  period: z.string().regex(/^\d{4}(-Q[1-4]|-\d{2})?$/),  // "2026" or "2026-Q1" or "2026-04"
  taxonomy: z.enum(["ESRS"]),
  companyName: z.string().min(1).max(200),
  leiCode: z.string().regex(/^[A-Z0-9]{20}$/).optional(),
});

// Response
{
  reportId: string;
  blobUrl: string;         // .xbrl file download URL
  conceptsTagged: number;
  untaggedMilestones: string[];
  period: string;
}
```

Auth: session required, must be contract owner or auditor email.
Rate limit: `xbrl-report:{userId}` — 10/hour.
maxDuration: 60s (add to `vercel.json`).

---

#### Validation & Download

- The generated `.xbrl` file references the official ESRS 2024 taxonomy schema at `xsi:schemaLocation`
- The `Report` record stores `type: "XBRL_ESRS"` (extend `type` field values)
- The board-pack page adds a "Download XBRL Filing" button when XBRL report exists for the period
- Note in UI: "Validate with ESMA's ESEF validator before submission"

---

#### Key Files

| File | Change |
|------|--------|
| `src/services/attestation/xbrl/esrs-concepts.ts` | New — ESRS concept lookup table |
| `src/services/attestation/xbrl/xbrl.service.ts` | New — XML generation |
| `src/app/api/reports/xbrl/route.ts` | New — POST endpoint |
| `vercel.json` | Add `maxDuration: 60` for xbrl route |
| `prisma/schema.prisma` | Extend `Report.type` accepted values in docs |

**Estimated effort:** 2.5 days

---

---

### Feature IX — Cryptographic Evidence Chain

**What:** Every attestation run produces a 4-step cryptographic chain that anyone can independently verify. Each step hashes the previous step's output plus new data, creating a tamper-evident audit trail that proves: (1) what data was fetched, (2) what AI prompt was used, (3) what the AI responded, (4) what was written on-chain. No other attestation platform provides this level of cryptographic transparency.

**Why it's unique:** Currently, a skeptic could say "how do I know cascrow didn't feed the AI different data or alter the response?" The evidence chain answers this definitively. It is the cryptographic equivalent of a notarized chain of custody, and it's what forensic auditors and regulators need.

**Analogy:** Similar in concept to Certificate Transparency logs or Git's commit DAG — each step commits to all previous steps.

---

#### Chain Structure

```
Step 0 — Raw Evidence Hash
  input:  raw fetched content (bytes)
  output: SHA256(rawContent)               → already stored as fetchedHash

Step 1 — Prompt Commitment
  input:  fetchedHash + systemPrompt + userPrompt (before AI call)
  output: SHA256(fetchedHash + systemPrompt + userPrompt)

Step 2 — Response Commitment
  input:  step1Hash + rawAiResponseText
  output: SHA256(step1Hash + rawAiResponseText)

Step 3 — On-Chain Anchor
  input:  step2Hash + xrplTxHash (or "NO_CHAIN_WRITE" if null)
  output: SHA256(step2Hash + xrplTxHash)
```

Final `chainRoot = step3Hash`. Stored in `AttestationEntry.evidenceChain`.

---

#### DB Changes

```prisma
// AttestationEntry additions
evidenceChain  Json?
// Stored structure:
// {
//   step0: string,  // = fetchedHash (SHA256 of raw content)
//   step1: string,  // SHA256(step0 + systemPrompt + userPrompt)
//   step2: string,  // SHA256(step1 + rawAiResponse)
//   step3: string,  // SHA256(step2 + xrplTxHash|"NO_CHAIN_WRITE")
//   promptHash: string,  // SHA256(systemPrompt + userPrompt) — allows prompt verification
//   systemPromptVersion: string,  // short version tag for the system prompt (e.g. "v1.2")
//   chainRoot: string,  // = step3 — the canonical fingerprint of this entire attestation run
// }
```

---

#### New Utility: `src/lib/evidence-chain.ts`

```typescript
import crypto from "crypto";

export interface EvidenceChain {
  step0: string;
  step1: string;
  step2: string;
  step3: string;
  promptHash: string;
  systemPromptVersion: string;
  chainRoot: string;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function buildEvidenceChain(
  rawContent: string,
  systemPrompt: string,
  userPrompt: string,
  rawAiResponse: string,
  xrplTxHash: string | null,
  systemPromptVersion = "v1"
): EvidenceChain {
  const step0 = sha256(rawContent);
  const step1 = sha256(step0 + systemPrompt + userPrompt);
  const step2 = sha256(step1 + rawAiResponse);
  const step3 = sha256(step2 + (xrplTxHash ?? "NO_CHAIN_WRITE"));
  return {
    step0,
    step1,
    step2,
    step3,
    promptHash: sha256(systemPrompt + userPrompt),
    systemPromptVersion,
    chainRoot: step3,
  };
}
```

Called in `runner.service.ts` after the XRPL write. The `rawAiResponse` is the full text from `response.content[0].text` before JSON parsing.

The chain is saved to `prisma.attestationEntry.create(...)` as `evidenceChain: buildEvidenceChain(...) as Prisma.InputJsonValue`.

---

#### Modified: `runner.service.ts`

```typescript
import { buildEvidenceChain } from "@/lib/evidence-chain";

// Inside runAttestation():
// After step 5 (XRPL write), before step 7 (create AttestationEntry):
const evidenceChain = buildEvidenceChain(
  rawContent,
  systemPrompt,
  userPrompt,
  rawAiResponseText,  // store the raw text before JSON.parse
  xrplTxHash,
  "v1"
);

// In prisma.attestationEntry.create():
evidenceChain: evidenceChain as Prisma.InputJsonValue,
```

---

#### Public Verification API: `POST /api/attestation/verify-chain`

No authentication required — fully public. This is the key to making the evidence chain useful for auditors.

```typescript
// Request body
{
  entryId: string,
  rawContent?: string,     // optional: provide the raw evidence to verify step0
  systemPrompt?: string,   // optional: provide to verify step1
  userPrompt?: string,
  aiResponse?: string,     // optional: provide to verify step2
}

// Response
{
  valid: boolean,
  chainRoot: string,          // the stored chain root from DB
  stepsVerified: {
    step0: boolean | null,    // null if rawContent not provided
    step1: boolean | null,
    step2: boolean | null,
    step3: boolean,           // always computable from DB data
  },
  firstFailingStep: 0 | 1 | 2 | 3 | null,
}
```

Rate limit: `verify-chain:{ip}` — 30/minute.

**How an auditor uses this:**
1. Download the "Verification Package" from the certificate page (see below)
2. The package contains all inputs needed to recompute the chain
3. Submit to `POST /api/attestation/verify-chain` (or compute locally using SHA256)
4. If all steps match → the attestation is provably unaltered

---

#### Certificate Page Extension (`/cert/attestation/[id]`)

Add a "Verification" section below the XRPL link:

```
Evidence Chain Fingerprint
[step0 hash truncated]  ← Raw evidence hash
[step1 hash truncated]  ← Prompt commitment
[step2 hash truncated]  ← AI response commitment
[step3 hash truncated]  ← On-chain anchor
Chain Root: [full chainRoot]

[Download Verification Package ↓]   [Verify Chain →]
```

"Download Verification Package" button: generates a JSON file client-side containing:
```json
{
  "entryId": "...",
  "fetchedAt": "...",
  "xrplTxHash": "...",
  "chain": { "step0": "...", "step1": "...", "step2": "...", "step3": "...", "chainRoot": "..." },
  "systemPromptVersion": "v1",
  "verifyUrl": "https://cascrow.com/api/attestation/verify-chain",
  "instructions": "POST rawContent + systemPrompt + userPrompt + aiResponse to verifyUrl to recompute the chain."
}
```

---

#### Key Files

| File | Change |
|------|--------|
| `src/lib/evidence-chain.ts` | New — SHA256 chain builder |
| `src/services/attestation/runner.service.ts` | Call `buildEvidenceChain`, save to entry |
| `prisma/schema.prisma` | Add `AttestationEntry.evidenceChain Json?` |
| `src/app/api/attestation/verify-chain/route.ts` | New — public verification POST |
| `src/app/cert/attestation/[id]/page.tsx` | Add chain display + download button |

**Estimated effort:** 1.5 days

---

---

### Feature X — Enterprise System Connectors (SAP / Workday / Salesforce)

**What:** Instead of manually providing a URL or API key, enterprise customers connect their existing ERP/CRM systems as certified data sources. The platform pulls KPI data directly — eliminating manual exports, copy-paste errors, and data manipulation risk.

**Why it's unique:** This is the integration layer that makes cascrow part of the enterprise data stack rather than a standalone tool. No other attestation platform has SAP or Workday connectors.

**New `dataSourceType` value:** `ENTERPRISE_CONNECTOR`

---

#### Supported Connectors (MVP)

| System | Protocol | Auth | Primary Use Cases |
|--------|----------|------|-------------------|
| **SAP S/4HANA** | OData v4 | Basic / OAuth2 PKCE | Revenue, cost centers, emission data |
| **Workday** | RaaS REST | API client credentials | Headcount, pay gap, diversity metrics |
| **Salesforce** | SOQL REST API | OAuth2 connected app | Pipeline revenue, NPS, customer metrics |
| **NetSuite** | SuiteQL REST | OAuth 1.0a | Financial reporting, P&L |

Phase 2 connectors (post-MVP): Microsoft Dynamics 365, HubSpot, Google Analytics 4, Stripe.

---

#### Connector Architecture

```
src/services/attestation/connectors/
├── types.ts           // ConnectorConfig, ConnectorResult interfaces
├── index.ts           // ConnectorRegistry — dispatches to correct connector
├── sap.connector.ts   // SAP S/4HANA OData v4
├── workday.connector.ts
├── salesforce.connector.ts
└── netsuite.connector.ts
```

**`src/services/attestation/connectors/types.ts`:**

```typescript
export interface ConnectorConfig {
  system: "SAP" | "WORKDAY" | "SALESFORCE" | "NETSUITE";
  baseUrl: string;           // e.g. "https://mycompany.my.sap.com"
  authType: "BASIC" | "OAUTH2_CLIENT" | "OAUTH1";
  // Auth fields (all encrypted at rest via existing encrypt.ts):
  clientId?: string;
  clientSecret?: string;     // stored encrypted
  username?: string;
  password?: string;         // stored encrypted
  tokenUrl?: string;
  // Query config:
  entity?: string;           // OData entity / SOQL object / RaaS report name
  filter?: string;           // OData $filter or SOQL WHERE clause
  selectFields?: string[];   // OData $select or SOQL SELECT fields
  responseField?: string;    // JSON path to the target value in response
}

export interface ConnectorResult {
  content: string;           // JSON string of the fetched data (for AI consumption)
  rawBytes: number;
  recordCount?: number;
  fetchedAt: Date;
}
```

**`src/services/attestation/connectors/index.ts`:**

```typescript
import { SapConnector } from "./sap.connector";
import { WorkdayConnector } from "./workday.connector";
import { SalesforceConnector } from "./salesforce.connector";
import { NetsuiteConnector } from "./netsuite.connector";

export async function fetchFromConnector(config: ConnectorConfig): Promise<ConnectorResult> {
  switch (config.system) {
    case "SAP": return new SapConnector().fetch(config);
    case "WORKDAY": return new WorkdayConnector().fetch(config);
    case "SALESFORCE": return new SalesforceConnector().fetch(config);
    case "NETSUITE": return new NetsuiteConnector().fetch(config);
  }
}
```

---

#### SAP Connector Detail (`sap.connector.ts`)

```typescript
// SAP S/4HANA OData v4 — fetch via standard API hub
// Example: GET /sap/opu/odata4/sap/api_financialplandata/srvd_a2x/sap/financialplandata/0001/FinancialPlanData
//   ?$filter=CompanyCode eq 'DE01' and FiscalYear eq '2026' and FiscalPeriod eq '006'
//   &$select=CompanyCode,FiscalYear,FiscalPeriod,Amount,Currency

class SapConnector {
  async fetch(config: ConnectorConfig): Promise<ConnectorResult> {
    // 1. Get access token (OAuth2 PKCE flow or Basic auth header)
    // 2. Build OData URL: baseUrl + "/sap/opu/odata4/" + entity + "?" + filter + select
    // 3. GET with Authorization header
    // 4. Extract value array from response.value[]
    // 5. Return as JSON string
  }
}
```

Key SAP entities for ESG/KPI attestation:
- `api_financialplandata` — Revenue, cost centers, plan vs. actual
- `api_companycode_srv` — Entity information, fiscal year config
- `api_ghgemissions` — GHG emissions (if SAP Sustainability Footprint is active)

---

#### Workday Connector Detail (`workday.connector.ts`)

Workday exposes custom reports via its Report-as-a-Service (RaaS) REST endpoint:
```
GET https://{tenant}.workday.com/ccx/service/customreport2/{tenant}/{owner}/{reportName}?format=json
Authorization: Bearer {token}
```

Config fields: `tenantName`, `reportOwner`, `reportName` → these are stored in `dataSourceConfig.entity`.

Common reports for attestation:
- `Headcount_by_Country` — employee counts
- `GenderPayGapReport` — pay equity metrics
- `DiversityDashboard` — DEI metrics
- Custom reports can be mapped by name

---

#### DB Changes

```prisma
// Milestone — extend existing dataSourceConfig Json? to also carry connector config
// No schema change needed — ConnectorConfig stored as part of existing dataSourceConfig
// BUT: add connector type tracking field:
dataSourceConnector  String?  // "SAP" | "WORKDAY" | "SALESFORCE" | "NETSUITE" | null
```

The encrypted credentials (`clientSecret`, `password`) are stored via `encryptApiKey()` from the existing `src/lib/encrypt.ts`, in `dataSourceApiKeyEnc`. For multi-credential systems (clientId + clientSecret), store as encrypted JSON.

---

#### Modified: `runner.service.ts`

Add `ENTERPRISE_CONNECTOR` branch in step 1:

```typescript
} else if (sourceType === "ENTERPRISE_CONNECTOR") {
  if (!milestone.dataSourceConfig) throw new Error("dataSourceConfig not set for ENTERPRISE_CONNECTOR");
  const config = milestone.dataSourceConfig as ConnectorConfig;
  if (milestone.dataSourceApiKeyEnc) {
    const decrypted = JSON.parse(decryptApiKey(milestone.dataSourceApiKeyEnc));
    config.clientSecret = decrypted.clientSecret;
    config.password = decrypted.password;
  }
  const result = await fetchFromConnector(config);
  rawContent = result.content;
}
```

---

#### New API Route: `POST /api/attestation/test-connector`

Dry-run fetch from an enterprise system — returns a preview of the data without writing anything.

```typescript
const testConnectorSchema = z.object({
  system: z.enum(["SAP", "WORKDAY", "SALESFORCE", "NETSUITE"]),
  baseUrl: z.string().url(),
  entity: z.string(),
  filter: z.string().optional(),
  // credentials passed directly (only for test — not stored)
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});
// Response: { success: true, preview: string (first 500 chars), recordCount: number }
//        or { success: false, error: string }
```

Rate limit: `test-connector:{userId}` — 10/hour.

---

#### Key Files

| File | Change |
|------|--------|
| `src/services/attestation/connectors/types.ts` | New |
| `src/services/attestation/connectors/index.ts` | New dispatcher |
| `src/services/attestation/connectors/sap.connector.ts` | New |
| `src/services/attestation/connectors/workday.connector.ts` | New |
| `src/services/attestation/connectors/salesforce.connector.ts` | New |
| `src/services/attestation/connectors/netsuite.connector.ts` | New |
| `src/services/attestation/runner.service.ts` | Add ENTERPRISE_CONNECTOR branch |
| `src/app/api/attestation/test-connector/route.ts` | New |
| `prisma/schema.prisma` | Add `Milestone.dataSourceConnector String?` |

**Estimated effort:** 4 days (2 days connectors, 1 day runner integration, 1 day UI + test endpoint)

---

---

### Feature XI — Multi-Party Consensus Attestation

**What:** Beyond AI + auditor, allow configurable M-of-N human parties (regulators, investors, committee members) to each independently cast a vote. Only when M votes reach the threshold is the final status determined and the certificate generated. Every vote is anchored to the blockchain.

**Why it's unique:** This is what makes cascrow viable as the technical layer beneath Big 4 audit engagements. A KPMG sign-off + AI verification + investor confirmation = a triple-verified ESG claim that is genuinely audit-grade. No other tool enables this workflow.

**Example configuration:** "Require 3-of-4 parties to verify: AI Platform + External Auditor + Board Committee + Investor Representative."

---

#### DB Changes

```prisma
// Milestone additions
consensusEnabled    Boolean @default(false)
consensusThreshold  Int?    // M — how many YES votes required
consensusStatus     String? // "AWAITING_VOTES" | "REACHED" | "FAILED" | "TIMED_OUT"
consensusDeadline   DateTime?  // votes must be cast by this date

// New model
model ConsensusVote {
  id          String   @id @default(cuid())
  milestoneId String
  partyEmail  String
  partyRole   String   // "AI_PLATFORM" | "AUDITOR" | "REGULATOR" | "INVESTOR" | "COMMITTEE"
  vote        String   // "YES" | "NO" | "ABSTAIN"
  reasoning   String?  @db.Text
  votedAt     DateTime @default(now())
  xrplTxHash  String?  // each vote is written to XRPL
  entryId     String?  // for AI_PLATFORM votes: linked AttestationEntry
  token       String   @unique  // one-time vote token (sent via email)
  tokenUsed   Boolean  @default(false)
  tokenExpiry DateTime

  milestone   Milestone @relation(fields: [milestoneId], references: [id])
  @@index([milestoneId])
  @@index([token])
}
```

---

#### Vote Flow (End-to-End)

**Step 1 — Configure (Owner):**
`POST /api/contracts/[id]/milestones/[milestoneId]/consensus/configure`
```json
{
  "enabled": true,
  "threshold": 3,
  "deadline": "2026-07-01",
  "parties": [
    { "role": "AUDITOR", "email": "partner@kpmg.com" },
    { "role": "INVESTOR", "email": "john@vcfund.com" },
    { "role": "COMMITTEE", "email": "cfo@company.com" }
  ]
}
```
Creates `ConsensusVote` records (one per party) with unique tokens, `vote = null` (pending), `tokenUsed = false`.
Sends invitation emails with vote links.

**Step 2 — AI runs normally:**
When `runAttestation()` completes, automatically creates the AI_PLATFORM `ConsensusVote` record with the AI verdict and writes to XRPL. If `consensusEnabled = false`, behavior is unchanged (backward compatible).

**Step 3 — Human parties vote:**
Each party receives: `POST https://cascrow.com/vote/[token]`
They see:
- Milestone title + description
- AI verdict + reasoning
- Evidence hash + XRPL link
- Evidence blob download (if they want to inspect raw data)
- Three buttons: **VERIFY (YES)** / **REJECT (NO)** / **ABSTAIN**
- Optional reasoning text field (max 500 chars)

On submit: `POST /api/attestation/consensus/vote`
```json
{ "token": "...", "vote": "YES", "reasoning": "Reviewed independently — figures match." }
```
This updates `ConsensusVote`, writes vote + reasoning to XRPL, checks if threshold is now reached.

**Step 4 — Threshold check:**
After each vote: count YES votes across all parties (AI + humans).
- If YES count ≥ threshold → `consensusStatus = "REACHED"`, generate final certificate, update `Milestone.status = "COMPLETED"`
- If NO count > (total_parties - threshold) → `consensusStatus = "FAILED"`, milestone `REJECTED`
- If deadline passes with insufficient votes → `consensusStatus = "TIMED_OUT"`, milestone `PENDING_REVIEW`

**Step 5 — Certificate:**
The final attestation certificate for consensus milestones includes an additional section:
```
Consensus Result: 3 of 4 parties verified
├── AI Platform: YES (cascrow automated verification)
├── KPMG Audit Partner: YES (independent re-verification)
├── CFO Committee: YES (board-level confirmation)
└── Investor Representative: ABSTAIN
```
Each vote's XRPL tx hash is listed.

---

#### API Routes

| Route | Method | Auth | What |
|-------|--------|------|------|
| `POST /api/contracts/[id]/milestones/[milestoneId]/consensus/configure` | POST | Owner | Enable consensus, add parties |
| `GET /api/contracts/[id]/milestones/[milestoneId]/consensus/status` | GET | Owner + Auditor | Current vote tally |
| `POST /api/attestation/consensus/vote` | POST | Token (no session) | Cast a vote |
| `GET /api/vote/[token]` | GET | Token | Validate token, return milestone info for voting UI |
| `POST /api/cron/consensus-timeout` | POST | CRON_SECRET | Check and mark timed-out consensus processes |

---

#### New Pages

- `/vote/[token]` — public voting page (no login required, token-gated)
  - Shows milestone details, AI verdict, evidence
  - Vote buttons + reasoning textarea
  - Styled consistently with the dark copper theme
  - After voting: "Your vote has been recorded on the XRP Ledger. TX: [hash]"

---

#### Modified: `runner.service.ts`

At the end of `runAttestation()`, after creating `AttestationEntry`:
```typescript
if (milestone.consensusEnabled) {
  // Create the AI_PLATFORM ConsensusVote
  await prisma.consensusVote.upsert({
    where: { token: `ai-${milestone.id}-${period}` },
    create: {
      milestoneId: milestone.id,
      partyEmail: "ai@cascrow.com",
      partyRole: "AI_PLATFORM",
      vote: verdict,
      reasoning,
      xrplTxHash,
      entryId: entry.id,
      token: `ai-${milestone.id}-${period}`,
      tokenUsed: true,
      tokenExpiry: new Date(0),  // AI vote never expires
    },
    update: { vote: verdict, reasoning, xrplTxHash, entryId: entry.id, tokenUsed: true },
  });
  // Check if threshold is now reached
  await checkConsensusThreshold(milestone.id);
}
```

**`checkConsensusThreshold(milestoneId)`** — shared helper that:
1. Counts YES/NO votes
2. Applies threshold logic
3. Updates `consensusStatus`
4. If REACHED: calls `generateAttestationCert` with full vote list, updates milestone status

---

#### Security Considerations

- Vote tokens are `cuid()` — not guessable
- Token expiry enforced on both GET (view) and POST (vote)
- Token is one-use (`tokenUsed = true` after voting — cannot re-vote)
- No session required — token is the auth mechanism for external parties
- Rate limit on `/api/attestation/consensus/vote`: 10/min per IP

---

#### Key Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ConsensusVote` model + `Milestone.consensus*` fields |
| `src/services/attestation/runner.service.ts` | Create AI vote + call threshold check |
| `src/app/api/contracts/[id]/milestones/[milestoneId]/consensus/configure/route.ts` | New |
| `src/app/api/contracts/[id]/milestones/[milestoneId]/consensus/status/route.ts` | New |
| `src/app/api/attestation/consensus/vote/route.ts` | New |
| `src/app/vote/[token]/page.tsx` | New — public voting page |
| `src/app/api/cron/consensus-timeout/route.ts` | New |
| `src/app/cert/attestation/[id]/page.tsx` | Add consensus section |
| `src/lib/email.ts` | Add `sendConsensusVoteInviteEmail` + `sendConsensusReachedEmail` |
| `vercel.json` | Add consensus-timeout cron + maxDuration for vote route |

**Estimated effort:** 3 days

---

## Phase 3 — Summary & Build Order

| Feature | Effort | Impact | Builds On |
|---------|--------|--------|-----------|
| VI — Predictive Miss Detection | 1.5 days | High | Phase 2 Pulse Checks |
| IX — Cryptographic Evidence Chain | 1.5 days | High | runner.service.ts |
| VIII — XBRL Filing Export | 2.5 days | Very High | Board Reports + Reg Mapping |
| VII — Double Materiality Wizard | 3 days | Very High | Wizard + Reg Mapping |
| XI — Multi-Party Consensus | 3 days | Very High | runner.service.ts + Auditor Portal |
| X — Enterprise Connectors | 4 days | Extreme | runner.service.ts fetchers |

**Recommended sprint order:**
1. Feature IX (Evidence Chain) — lowest risk, highest credibility uplift, 1.5 days
2. Feature VI (Predictive Miss) — extends existing pulse-check infra, 1.5 days
3. Feature VIII (XBRL) — major enterprise sales trigger, 2.5 days
4. Feature VII (Materiality Wizard) — CSRD compliance entry point, 3 days
5. Feature XI (Multi-Party Consensus) — Big 4 partnership enabler, 3 days
6. Feature X (Enterprise Connectors) — SAP/Workday integrations, 4 days

Total Phase 3 estimated effort: ~15–16 days

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
