# cascrow — Feature Planning & Implementation Roadmap

> This file tracks planned features with full implementation details.
> Reference this in new Claude sessions to continue work without losing context.
> Last updated: 2026-04-18

---

## Full-Stack AI Expansion

The goal is to position cascrow not as "an escrow platform with AI features" but as the **AI operating system of the entire contract lifecycle** — from drafting to credibility to coaching to dispute resolution. Every decision point has AI, humans are only invoked when AI has genuinely exhausted its judgment.

| Contract Phase | Without AI | With New Features |
|---|---|---|
| Contract creation | Investor writes manually | **Feature A: AI drafts milestones** |
| Funding decision | Investor has no info on startup | **Feature B: AI Credibility Score** |
| Proof preparation | Startup guesses what to submit | **Feature D: AI Proof Coach** |
| Verification | 5-model vote ✅ (live) | Already done |
| Rejection | Straight to human admin | **Feature C: AI Dispute Arbitration** |

---

## Implementation Order

Build in this order — smallest risk and highest visible impact first:

1. **Feature D** — Proof Guidance (2 DB fields, 1 API route, no risk)
2. **Feature A** — AI Contract Drafting (no DB changes, high marketing impact)
3. **Feature B** — Credibility Scoring (new DB model, GitHub API, no flow changes)
4. **Feature C** — Dispute Arbitration (most complex, touches money flow, do last)

---

## Feature A: AI Contract Drafting

**Replaces:** Grants consultant / milestone advisor  
**Marketing:** "Describe your project in plain English — AI structures the deal in seconds."

### What it does
Investor types a plain-text project description → AI generates a milestone plan (titles, amounts in USD, deadlines in days) → pre-fills the contract form. Everything remains editable before submission.

### API
`POST /api/contracts/draft`

Request:
```json
{ "description": "string (min 20, max 2000 chars)" }
```

Response:
```json
{
  "projectTitle": "string",
  "milestones": [
    { "title": "string", "amountUSD": 500, "deadlineDays": 30 }
  ]
}
```

Auth: session required (investor only).  
Rate limit: `contract-draft:{userId}` — 10/hour.  
No DB writes — the form submits to `/api/contracts` as usual.

### DB Changes
None.

### UI Integration
File: `src/components/contract-form.tsx`

Add a collapsible "Let AI draft this for you" link above the Milestones section that expands into:
- Textarea: "Describe your project in plain English" (2000 char max with counter)
- Button: "Generate Milestone Plan" (amber/copper brand style)
- Loading state: "AI is drafting your milestones…"
- On success: calls `setProjectTitle()` and `setMilestones()` with the response
- Amber banner below generated milestones: "AI-generated — review and edit before creating the contract."

### AI Strategy
Model: **Claude Haiku** (structured JSON extraction, cheap, fast)

System prompt pattern:
```
You are a startup milestone planning assistant for an escrow platform.
Respond with ONLY valid JSON: { "projectTitle": "...", "milestones": [...] }
Rules: 2-6 milestones, chronological, verifiable deliverables, min $100/max $200k per milestone, 14-180 day deadlines.
Never use vague descriptions like "make progress".
```

### Cost
~700 tokens/call → ~$0.0015/call → **~$0.15/month at 100 contracts/month**

---

## Feature B: AI Credibility Scoring

**Replaces:** Due diligence firms  
**Marketing:** "Know who you're funding before you fund them."

### What it does
Before the investor funds, AI analyzes the startup using free data sources: GitHub public API, cascrow internal contract history, profile completeness, email/KYC verification. Output: score 0–100, tier (HIGH/MEDIUM/LOW), signal list, 2–3 sentence summary.

### API
`GET /api/contracts/[id]/credibility`

Response:
```json
{
  "score": 75,
  "tier": "MEDIUM",
  "signals": [
    { "label": "Email verified", "value": "Yes", "positive": true },
    { "label": "Previous contracts", "value": "2 completed, 0 failed", "positive": true },
    { "label": "Company profile", "value": "Not filled in", "positive": false }
  ],
  "summary": "2-3 sentence investor-facing explanation",
  "cachedAt": "ISO timestamp"
}
```

Auth: session required, only the contract's investor.  
Rate limit: `credibility:{userId}` — 20/hour.  
Cache: 7-day TTL in DB. Investor can force recalculation.  
Cache invalidation: delete cache row when startup completes or fails a contract.

### DB Changes
New model:
```prisma
model CredibilityScore {
  id         String   @id @default(cuid())
  startupId  String
  contractId String
  score      Int                          // 0-100
  tier       String                       // "HIGH" | "MEDIUM" | "LOW"
  signals    Json                         // [{label, value, positive}]
  summary    String   @db.Text
  rawSignals Json                         // raw data for audit/debugging
  cachedAt   DateTime @default(now())
  createdAt  DateTime @default(now())

  @@unique([startupId, contractId])
  @@index([startupId])
  @@index([contractId])
}
```

### UI Integration
File: `src/app/contract/[id]/page.tsx` and layout

Fetch credibility score in `page.tsx` when viewer = investor and status = `AWAITING_ESCROW`. Pass as prop to a new `<CredibilityPanel>` server component rendered above `<ContractActions>`.

Panel shows:
- Circular score badge (green ≥80, amber 50–79, red <50)
- Bullet list of signals (positive = green, negative = red)
- AI summary text
- "Recalculate" button (client component, calls the API route)
- "Score calculated X hours ago" note

Also show (collapsed/dimmed) when status = `FUNDED` so investor can still reference it.

### AI Strategy
Model: **Claude Haiku**

Data assembled before the AI call:
- Account age, email verified, KYC tier, company name/bio/website filled (from DB)
- Past contracts: completed count, rejected proof count, total RLUSD received (from DB)
- GitHub (if URL in profile/website): account age, public repos, total stars, last commit date (GitHub public API, no key needed for basic)

System prompt pattern:
```
You are a startup credibility analyst for an escrow funding platform.
Evaluate based ONLY on provided signals. Do NOT invent signals.
Respond ONLY with valid JSON: { "score": 75, "tier": "MEDIUM", "summary": "...", "signals": [...] }
Scoring guide: 80-100 LOW RISK, 50-79 MEDIUM RISK, 0-49 HIGH RISK
```

### Cost
~$0.001/call, 7-day cache → **~$0.13/month at 100 contracts/month**

---

## Feature C: AI Dispute Arbitration

**Replaces:** Human admin review panel, arbitration  
**Marketing:** "Every rejection can be appealed. AI arbitrates — humans step in only for the hardest cases."

### What it does
When AI rejects a proof, instead of going straight to human admin review, the startup goes through a **Guided Appeal Wizard** — structured multiple-choice + per-objection responses. AI re-reviews with this context. Only if AI upholds the rejection does it escalate to a human.

### The Guided Appeal Wizard UX

Three steps, NOT a chat bot — a smart guided form:

**Step 1 — Category (Radio Buttons)**
> "Why do you believe this rejection was incorrect?"
- The AI misunderstood what the milestone required
- I have additional evidence I can provide now
- The AI evaluated the wrong section of my document
- The milestone criteria were ambiguous or unclear
- Technical issue with my uploaded file

This category is included in the AI re-review prompt as metadata — it tells the AI how to frame its reconsideration.

**Step 2 — Address each AI objection**
Each AI rejection reason is shown individually with a textarea below it:
> ❌ "No evidence of the 10 required user sign-ups was provided."
> *Your response:* [textarea]

Forces the startup to be concrete. Not "this is unfair" but actual counter-evidence.

**Step 3 — Additional context (optional)**
Free text + optional file upload or URL.
> "Anything else you want to add?"

Then a summary review before submitting.

### APIs

`GET /api/proof/[proofId]/rejection-detail`  
Returns structured objections from `aiRejectionObjections`. No AI call needed — just formats existing data.

`POST /api/proof/[proofId]/appeal`  
Request:
```json
{
  "category": "ADDITIONAL_EVIDENCE | MISUNDERSTOOD | WRONG_SECTION | AMBIGUOUS | TECHNICAL",
  "rebuttals": [
    { "objectionId": "1", "response": "Here is the link to our analytics..." }
  ],
  "additionalContext": "optional string (max 1000 chars)"
}
```
Validates: only startup on this contract, `appealStatus` must be null, milestone must be `REJECTED`.  
Calls Claude Haiku with full context → updates DB → triggers release (if YES) or escalates to admin (if NO).

`GET /api/proof/[proofId]/appeal-status`  
Lightweight poll endpoint for the client while waiting.

### DB Changes
New fields on `Proof` model:
```prisma
// Structured objections generated at rejection time
aiRejectionObjections  Json?      // [{id: string, text: string}]

// Appeal flow
appealStatus           String?    // "NOT_APPEALED" | "APPEAL_PENDING" | "APPEAL_REVIEWED"
appealCategory         String?    // The radio button selection from Step 1
appealRebuttals        Json?      // [{objectionId: string, response: string}]
appealContext          String?    @db.Text
appealDecision         String?    // "APPROVED" | "REJECTED"
appealReasoning        String?    @db.Text
appealSubmittedAt      DateTime?
appealReviewedAt       DateTime?
```

New AuditLog event strings: `APPEAL_SUBMITTED`, `APPEAL_APPROVED`, `APPEAL_REJECTED`

### UI Integration
File: `src/app/contract/[id]/contract-actions.tsx` — REJECTED block

Currently shows "AI rejected the proof" + "Resubmit New Proof" button.

New layout when `appealStatus` is null:
- "Appeal This Decision" button alongside "Resubmit" button
- Clicking "Appeal" expands the Guided Wizard (3 steps above)
- Disclaimer: "You have one appeal per rejection. If AI upholds the rejection, your case goes to the Grant Giver for manual review."

When `appealStatus === "APPEAL_PENDING"`: loading state  
When `appealDecision === "REJECTED"`: "Escalated to Grant Giver for manual review."  
When `appealDecision === "APPROVED"`: status transitions to VERIFIED — existing block handles display

New props needed on `ContractActions`:
- `latestProofAppealStatus`
- `latestProofAppealDecision`
- `latestProofRejectionObjections`

### AI Strategy — Two Calls

**Call 1: Generate structured objections** (added to end of existing `verifyMilestone()` when decision = NO)  
Model: Claude Haiku  
Prompt: "Convert this rejection reasoning into a JSON array of max 5 specific, addressable objections: [{id, text}]"  
~100 tokens in/out → ~$0.0005/rejection

**Call 2: Appeal re-review**  
Model: Claude Haiku  
System prompt includes the category metadata to frame the reconsideration.  
Full context: original milestone, original objections, startup's rebuttals, category selection, additional context.  
Response: `{ "decision": "YES|NO", "reasoning": "...", "addressedObjections": ["1"], "unresolvedObjections": ["2"] }`  
~600 tokens in, ~150 out → ~$0.001/appeal

### Cost
~$0.0005 per rejection + ~$0.001 per appeal (~40% appeal rate)  
**~$0.04/month at 100 contracts/month**

---

## Feature D: AI Proof Guidance (Pre-Submission)

**Replaces:** Milestone advisor, guesswork  
**Marketing:** "Your AI proof coach tells you exactly what evidence will get approved, before you submit."

### What it does
Before the startup uploads their proof, AI generates a specific checklist of what to include — based on the milestone description. Permanently cached per milestone (generated once, free forever after).

### API
`GET /api/contracts/[id]/milestones/[milestoneId]/guidance`

Response:
```json
{
  "tone": "Here's what will make your proof bulletproof:",
  "checklist": [
    { "item": "Include a live public URL", "why": "AI verifiers check for accessible deployments" },
    { "item": "Screenshot showing 10+ user signups", "why": "Milestone requires 10 real users" }
  ],
  "cachedAt": "ISO timestamp"
}
```

Auth: only the startup on this contract.  
Cache: permanent — stored in `Milestone.proofGuidance`. Generated once, never regenerated.

### DB Changes
Two new fields on `Milestone` model:
```prisma
proofGuidance         Json?      // {tone: string, checklist: [{item, why}]}
proofGuidanceCachedAt DateTime?
```

Optimization: since `page.tsx` already fetches milestones with `include`, pass `proofGuidance` as a prop from the server — avoids a separate client-side API fetch for cached guidance. Only fall back to the API route for first-time generation.

### UI Integration
File: `src/app/contract/[id]/contract-actions.tsx` — FUNDED block, above `<ProofUpload>`

New `<ProofGuidance>` client component:
- Amber/copper "AI Coach" badge in top-right corner
- `tone` text in italics as opener
- Checklist as interactive checkboxes (cosmetic only — does NOT gate upload)
- Each item has a subtle `why` note in smaller text below
- Does NOT block upload — always shown alongside `<ProofUpload>`, never instead of it

### AI Strategy
Model: **Claude Haiku**

System prompt pattern:
```
You are a friendly proof coach for a startup milestone escrow platform.
Help startups submit evidence that passes AI verification.
Be encouraging, specific, practical. Write like a helpful mentor.
Respond ONLY with valid JSON: { "tone": "...", "checklist": [{item, why}] }
Rules: 4-7 items, specific to this milestone, imperative verbs ("Include...", "Screenshot...", "Link to...")
```

User message: just the milestone title/description.

### Cost
~$0.0007/milestone (one-time)  
**~$0.14/month at 100 contracts/month, then trends toward $0** as most milestones already have cached guidance

---

## Stats Page Additions

Once features are live, add these to `src/app/stats/page.tsx`:

| Metric | Source |
|---|---|
| AI Drafts Generated | `ApiUsage` where `context = "drafting"` |
| Avg Credibility Score | `AVG(CredibilityScore.score)` across funded contracts |
| Disputes Resolved Without Human | `COUNT(Proof WHERE appealDecision = "APPROVED") / COUNT(appeals)` |
| Proof Checklists Generated | `COUNT(Milestone WHERE proofGuidance IS NOT NULL)` |

---

## Landing Page Updates

Add a new "Full-Stack AI" section to the features grid (`#features` anchor) with 4 cards, one per feature. Use the existing `<ScrollReveal>` wrapper and brand colors.

Card headlines:
- "AI Contract Drafting" — Describe your project, get a milestone plan
- "Credibility Scoring" — Know who you're funding before you fund them  
- "Proof Coaching" — Your AI coach, before you submit
- "Smart Dispute Resolution" — Appeals handled by AI. Humans for the hardest cases only.

Consider a live counter: "X disputes resolved autonomously" — DB query on each render.

---

## Total Cost Estimate (Phase 1 — Features A–D)

All 4 features combined: **under $1/month at 100 contracts/month**  
All on existing API keys (Anthropic), no new paid services, GitHub public API is free.

---

## Key Files to Edit (Phase 1)

| Feature | Primary Files |
|---|---|
| A — AI Drafting | `src/components/contract-form.tsx`, new `src/app/api/contracts/draft/route.ts` |
| B — Credibility | `src/app/contract/[id]/page.tsx`, new `src/app/api/contracts/[id]/credibility/route.ts`, `prisma/schema.prisma` |
| C — Dispute | `src/app/contract/[id]/contract-actions.tsx`, new `src/app/api/proof/[proofId]/appeal/route.ts`, `src/services/ai/verifier.service.ts` (add objection generation), `prisma/schema.prisma` |
| D — Guidance | `src/app/contract/[id]/contract-actions.tsx`, new `src/app/api/contracts/[id]/milestones/[milestoneId]/guidance/route.ts`, `prisma/schema.prisma` |
| All | `src/app/stats/page.tsx`, `src/app/page.tsx` (landing), `src/lib/zod-schemas.ts` (new schemas) |

---

## Phase 2 Features

These extend cascrow's AI coverage to the remaining gaps in the contract lifecycle.

### Feature E: AI Fraud Detection

**Replaces:** Manual plagiarism / fake-proof check  
**Marketing:** "Every proof is screened for authenticity before AI review."  
**Build after:** Features A–D are live and there are enough real proofs to validate detection heuristics.

### What it does
Before the 5-model verification vote runs, a lightweight fraud pre-screen checks:
- GitHub repo created <7 days before proof submission → Red Flag
- PDF appears AI-generated (low lexical variety, unnatural sentence uniformity) → Warning
- Identical file hash already submitted on another contract → Block
- Screenshot appears to be a stock photo (reverse image heuristic) → Warning

Output: not a blocker by default, but a structured `AuthenticityWarning` that:
1. Gets appended to the AI verification prompt as additional context
2. Is displayed to the investor on the contract page

### DB Changes
New fields on `Proof`:
```prisma
authenticityFlags   Json?    // [{type: string, severity: "WARNING"|"RED_FLAG", detail: string}]
authenticityScore   Int?     // 0-100, 100 = fully authentic
```

### API / Integration
No new API route needed. Add a `runFraudPreScreen(proof)` function to `src/services/ai/verifier.service.ts` that runs before the main `verifyMilestone()` call. Results stored on the Proof record and passed into the verification prompt context.

### Cost
Mostly free — DB hash checks and heuristics. One optional cheap Haiku call for AI-generated-text detection. **~$0.05/month.**

---

### Feature F: AI Milestone Renegotiation

**Replaces:** Lawyer / mediator when deadlines slip  
**Marketing:** "When deadlines slip, cascrow's AI mediates — not lawyers."

### What it does
When a milestone deadline expires and no proof has been submitted, instead of an immediate auto-cancel, a **48-hour renegotiation window** opens. The startup can request an extension — but only by uploading an **interim progress update** showing that real work has happened.

### Full Flow

1. Deadline expires → cron job detects expired milestones (extend existing `cancel-expired` cron)
2. Instead of immediate cancel: set milestone status to `RENEGOTIATING`, send email/Telegram to both parties
3. **Startup must upload a progress update** to request extension:
   - Short text: "What have you done so far? What's left?" (min 100 chars)
   - Optional file: screenshot, partial build, document
4. **AI assesses the interim update** (one Haiku call):
   - "Based on this progress update, completion within an additional [X] days seems plausible / unlikely."
   - Flags if the update is vague or contains no concrete evidence
5. **Grant Giver sees**: the interim update + AI assessment + proposed extension length
6. Grant Giver chooses: Approve Extension / Reject (trigger cancel)
7. If Grant Giver does not respond within 48h → auto-cancel proceeds
8. If extension approved → new deadline set, milestone back to `FUNDED` status

### DB Changes
New fields on `Milestone`:
```prisma
renegotiationStatus      String?    // "RENEGOTIATING" | "EXTENSION_REQUESTED" | "EXTENSION_APPROVED" | "EXTENSION_REJECTED"
renegotiationDeadline    DateTime?  // when the 48h window closes
interimUpdateText        String?    @db.Text
interimUpdateFileUrl     String?
interimUpdateFileName    String?
interimAiAssessment      String?    @db.Text  // Haiku's plausibility assessment
interimAiPositive        Boolean?             // true = plausible, false = unlikely
extensionDays            Int?                 // how many days extension requested
extensionApprovedAt      DateTime?
```

New milestone status: `RENEGOTIATING` (add to status enum and UI status colors/labels)

### API Routes
- `POST /api/contracts/[id]/milestones/[milestoneId]/renegotiate` — startup submits interim update + requested extension days
- `POST /api/contracts/[id]/milestones/[milestoneId]/renegotiate/respond` — grant giver approves or rejects

### UI Integration
- New `RENEGOTIATING` status block in `contract-actions.tsx`:
  - **Startup view**: form to upload interim update + choose extension days (7/14/30 options)
  - **Investor view**: shows interim update text + file + AI assessment + Approve/Reject buttons
- Countdown timer showing when the 48h window closes

### AI Strategy
Model: Claude Haiku, one call when startup submits interim update.  
Prompt: given the original milestone description + the interim update, assess plausibility of completion.  
Response: `{ "plausible": true/false, "assessment": "2 sentence summary", "concerns": ["..."] }`

### Cost
~$0.001 per renegotiation. **~$0.05/month** assuming ~10% of milestones miss deadline.

---

### Feature G: AI Progress Check-ins

**Replaces:** Project manager / weekly status calls  
**Marketing:** "Investors see progress without micromanaging. Startups stay accountable without feeling surveilled."

### What it does
Every Tuesday after a milestone is funded, an automated check-in goes to the startup via email (and optionally Telegram):

> "Quick check-in for [Milestone Title] — how's it going? Reply in 1-2 sentences."

The response (email reply or Telegram message) is logged and displayed to the investor as a timeline of updates. Optionally, AI summarizes the check-in history into a "Progress Summary" for the investor.

### Implementation
- New cron job: `GET /api/cron/progress-checkins` — runs every Tuesday, finds all `FUNDED` milestones, sends check-in emails
- Startup replies to email → inbound email webhook (Resend supports inbound parsing) captures and logs
- Or: simpler version — a "Log Progress Update" button in the startup's dashboard that sends a short text
- Updates stored in a new `ProgressUpdate` model

### DB Changes
New model:
```prisma
model ProgressUpdate {
  id          String   @id @default(cuid())
  milestoneId String
  text        String   @db.Text
  source      String   // "EMAIL_REPLY" | "MANUAL" | "TELEGRAM"
  createdAt   DateTime @default(now())

  @@index([milestoneId])
}
```

### Cost
Zero AI cost for the check-in itself (just email). Optional Haiku call to summarize history: ~$0.001/summary. **Essentially free.**

---

### Feature H: AI Reputation System

**Replaces:** References, LinkedIn recommendations  
**Marketing:** "Your on-chain track record, automatically built with every completed milestone."

### What it does
When a milestone is completed, AI auto-generates a **privacy-safe performance card** that becomes part of the startup's permanent profile. Multiple completed milestones build a full reputation score.

### Privacy Design
The full milestone description is **never shown publicly**. Instead, AI generates a sanitized summary that:
- Removes company names, partner names, revenue figures, specific URLs
- Keeps only the category and achievement type: "Shipped a functional MVP with active users"
- Startup opts in per milestone to make the card public (default: private)

Public profile shows only **aggregated metrics**:
- Total milestones completed
- On-time delivery rate (%)
- Average AI confidence score
- Average resubmissions before approval
- Categories (MVP, Revenue, Partnership, etc. — from a fixed taxonomy)

The NFTs (already live) serve as the on-chain proof of completion. The Reputation System is the **human-readable aggregate layer** on top of the NFTs.

### DB Changes
New fields on `Milestone`:
```prisma
reputationSummary     String?   @db.Text   // AI-generated privacy-safe summary
reputationPublic      Boolean   @default(false)  // startup opt-in
reputationCategory    String?   // "MVP" | "REVENUE" | "PARTNERSHIP" | "GITHUB" | "BETA" | "OTHER"
```

New model:
```prisma
model ReputationScore {
  id                  String   @id @default(cuid())
  userId              String   @unique
  totalCompleted      Int      @default(0)
  onTimeRate          Float?   // 0.0-1.0
  avgAiConfidence     Float?
  avgResubmissions    Float?
  categories          Json     // {MVP: 2, REVENUE: 1, ...}
  lastCalculatedAt    DateTime @default(now())
}
```

Recalculated on every milestone completion.

### API / Integration
- `GET /api/user/[userId]/reputation` — public endpoint, returns score + public milestone cards
- Shown on the startup's public profile page (new page: `/profile/[userId]`)
- Referenced in Feature B (Credibility Scoring): high reputation score → higher credibility score

### Cost
One Haiku call per completed milestone to generate the privacy-safe summary.  
~$0.001/completion. **~$0.10/month** at 100 completions/month.

---

## Phase 3 Features (Quick Wins)

Three features with minimal build effort, high visual impact, and immediate user value.

---

### Feature I: AI Proof Pre-Check

**Replaces:** Guesswork before submitting proof  
**Marketing:** "Test your proof before you submit — AI tells you what's missing."  
**Effort:** 1 new API route, no DB changes

### What it does
Before officially submitting, the startup clicks "Test my proof" on an already-uploaded file. Runs a single-model (Haiku) soft check — not the full 5-model vote, no status change, no DB record as an official submission. Returns plain-language feedback:

> "Your proof looks strong — the URL is accessible and shows active users. Consider adding a screenshot of the signup count to make the 10-user requirement undeniable."

If the pre-check looks good, they proceed to the real Submit. If not, they improve first.

### API
`POST /api/proof/precheck`

Request:
```json
{ "milestoneId": "string", "fileUrl": "string", "fileName": "string" }
```

Response:
```json
{
  "verdict": "LIKELY_PASS" | "LIKELY_FAIL" | "BORDERLINE",
  "feedback": "Plain-language feedback string",
  "suggestions": ["string"]
}
```

Auth: startup on the contract only.  
Rate limit: `proof-precheck:{userId}` — 5/hour (prevents using pre-check as a free unlimited verifier).  
No status change, no AuditLog entry, no official Proof record created.

### AI Strategy
Model: Claude Haiku (single model, not 5-model vote — this is advisory only).  
Reuse the existing prompt structure from `verifier.service.ts` but single-shot, with an explicit "advisory only" framing.

### Cost
~$0.001/pre-check. **~$0.10/month** assuming ~1 pre-check per milestone.

---

### Feature J: AI Contract Risk Flags

**Replaces:** Experienced grants advisor spotting structural problems  
**Marketing:** "AI reviews your contract before anyone signs — flags issues before they become disputes."  
**Effort:** 1 JSON field on Contract, 1 Haiku call at contract creation

### What it does
When a contract is first created (end of `POST /api/contracts`), one Haiku call analyses all milestones together and flags structural problems:

- Milestone descriptions with no measurable criteria → hard to verify
- Deadline of Milestone 2 shorter than Milestone 1 → unrealistic sequencing
- Total amount seems disproportionate to the milestone scope
- A milestone describes multiple distinct deliverables → should be split

Shown on the contract detail page as a collapsible "AI Risk Review" panel. Not a blocker — purely advisory. Visible to both parties.

### DB Changes
One new field on `Contract`:
```prisma
riskFlags   Json?   // [{severity: "WARNING"|"INFO", text: string}]
```

### UI Integration
File: `src/app/contract/[id]/page.tsx`

New collapsible panel between the project overview card and the milestone timeline. Only shown if `riskFlags` is non-null and non-empty. Title: "AI Risk Review" with an amber warning icon. Each flag shown as a bullet with severity indicator.

### AI Strategy
Model: Claude Haiku, one call at contract creation end.  
Input: all milestone titles, amounts, deadlines as a structured list.  
Response: `[{ "severity": "WARNING"|"INFO", "text": "plain-language flag" }]`  
Max 5 flags. If no issues found, returns empty array — panel not shown.

### Cost
~$0.001/contract. **~$0.10/month** at 100 contracts/month. Stored permanently — never recalculated.

---

### Feature K: Deal Health Score

**Replaces:** Investor manually checking each contract for status  
**Marketing:** "At a glance, know which deals need your attention."  
**Effort:** Pure logic on existing data, no AI call needed for the indicator itself

### What it does
Every contract card in the investor dashboard shows a small traffic-light health indicator computed from existing DB data — no AI call required for the score itself:

- 🟢 **On Track** — funded, deadline >7 days away, proof submitted, or check-ins positive
- 🟡 **Watch** — deadline in ≤7 days, no proof submitted yet
- 🔴 **At Risk** — deadline passed, no proof, or currently `RENEGOTIATING`

Optional enhancement: one Haiku call per contract per day (cached in DB) that generates a single-sentence context note shown on hover:
> "Startup has responded to 3 check-ins but no proof yet — follow up recommended."

### DB Changes
Optional (only if the AI summary note is added):
```prisma
// On Contract model
healthNote          String?    // AI-generated single sentence, cached
healthNoteUpdatedAt DateTime?
```

The traffic-light color itself requires zero DB changes — computed client-side from `status`, `cancelAfter`, and existing milestone data already returned by the dashboard query.

### UI Integration
File: `src/app/dashboard/investor/page.tsx` (or wherever the contract list renders)

Small colored dot + label in the top-right of each contract card. On hover/click: shows the optional AI context note. The color logic is a simple pure function:
```ts
function dealHealth(contract): "GREEN" | "YELLOW" | "RED" {
  if (contract.status === "RENEGOTIATING") return "RED"
  if (new Date(contract.cancelAfter) < new Date()) return "RED"
  const daysLeft = (new Date(contract.cancelAfter).getTime() - Date.now()) / 86400000
  if (daysLeft <= 7 && contract.status === "FUNDED") return "YELLOW"
  return "GREEN"
}
```

### Cost
Zero for the indicator (pure logic). Optional AI note: ~$0.001/contract/day if enabled. Recommend caching with 24h TTL. **~$0.10/month** even with notes enabled.

---

## Complete AI Lifecycle Map

```
Contract Creation  → A: AI drafts milestones + J: Risk flags on all milestones
Funding Decision   → B: AI credibility score (GitHub + history + profile)
Ongoing Monitoring → K: Deal health score on dashboard + G: Weekly check-ins
Proof Preparation  → D: AI proof coach (checklist) + I: Proof pre-check
Proof Submission   → E: AI fraud pre-screen (before verification)
Verification       → 5-model majority vote ✅ (live)
Rejection          → C: AI dispute arbitration (guided appeal wizard)
Deadline Expired   → F: AI renegotiation (interim update → grant giver approval)
Completion         → H: AI reputation card (privacy-safe, opt-in public)
```

No human intermediary is required at any step. Humans are only invoked when AI has genuinely exhausted its judgment (final appeal escalation, renegotiation approval by grant giver).

---

## Phase 2 Key Files

| Feature | Primary Files |
|---|---|
| E — Fraud Detection | `src/services/ai/verifier.service.ts` (add pre-screen), `prisma/schema.prisma` |
| F — Renegotiation | `src/app/api/cron/cancel-expired/route.ts` (extend), new renegotiate API routes, `src/app/contract/[id]/contract-actions.tsx`, `prisma/schema.prisma` |
| G — Check-ins | new `src/app/api/cron/progress-checkins/route.ts`, new `ProgressUpdate` model, `src/lib/email.ts` |
| H — Reputation | new `src/app/api/user/[userId]/reputation/route.ts`, new `/profile/[userId]/page.tsx`, `prisma/schema.prisma` |

## Phase 3 Key Files

| Feature | Primary Files |
|---|---|
| I — Proof Pre-Check | new `src/app/api/proof/precheck/route.ts`, `src/app/contract/[id]/contract-actions.tsx` |
| J — Risk Flags | `src/app/api/contracts/route.ts` (extend POST), `src/app/contract/[id]/page.tsx`, `prisma/schema.prisma` |
| K — Deal Health | `src/app/dashboard/investor/page.tsx`, optional `prisma/schema.prisma` (health note cache) |
