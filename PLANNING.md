# cascrow — Feature Planning & Implementation Roadmap

> This file tracks planned features with full implementation details.
> Reference this in new Claude sessions to continue work without losing context.
> Last updated: 2026-04-19

---

## Implementation Status

| Feature | Status | Commit | Notes |
|---|---|---|---|
| **Feature D** — AI Proof Guidance | ✅ DONE | `029737fb` | `Milestone.proofGuidance`, `GET /api/contracts/[id]/milestones/[milestoneId]/guidance`, `<ProofGuidance>` in contract-actions |
| **Feature B** — AI Credibility Score | ✅ DONE | `9908f894` | `CredibilityScore` DB model, `GET /api/contracts/[id]/credibility`, `<CredibilityPanel>` component, 7-day cache |
| **Feature C** — AI Dispute Arbitration | ✅ DONE | `8ffc14ff` | 6 new `Proof` fields (`aiObjections`, `appealStatus/Text/Result/Reasoning/At`), `POST /api/proof/[proofId]/appeal`, Appeal Wizard UI in contract-actions |
| **Feature A** — AI Contract Drafting | ✅ DONE | `c47a3d65` | `POST /api/contracts/draft`, collapsible AI panel in `contract-form.tsx`, rate-limited 10/hr |
| **Feature E** — AI Fraud Detection | ⬜ TODO | — | Pre-screen before 5-model vote; `authenticityFlags` + `authenticityScore` on Proof |
| **Feature F** — AI Milestone Renegotiation | ⬜ TODO | — | `RENEGOTIATING` status, 48h window, interim update + Haiku plausibility check |
| **Feature G** — AI Progress Check-ins | ⬜ TODO | — | Scheduled nudges/reminders via email/Telegram |
| **Feature H** — AI Reputation System | ⬜ TODO | — | Cross-contract reputation score per startup |

---

## Full-Stack AI Expansion

The goal is to position cascrow not as "an escrow platform with AI features" but as the **AI operating system of the entire contract lifecycle** — from drafting to credibility to coaching to dispute resolution. Every decision point has AI, humans are only invoked when AI has genuinely exhausted its judgment.

| Contract Phase | Without AI | With New Features |
|---|---|---|
| Contract creation | Investor writes manually | **Feature A: AI drafts milestones** ✅ |
| Funding decision | Investor has no info on startup | **Feature B: AI Credibility Score** ✅ |
| Proof preparation | Startup guesses what to submit | **Feature D: AI Proof Coach** ✅ |
| Verification | 5-model vote ✅ (live) | Already done |
| Rejection | Straight to human admin | **Feature C: AI Dispute Arbitration** ✅ |

---

## Implementation Order

Build in this order — smallest risk and highest visible impact first:

1. **Feature D** — Proof Guidance (2 DB fields, 1 API route, no risk) ✅ DONE
2. **Feature A** — AI Contract Drafting (no DB changes, high marketing impact) ✅ DONE
3. **Feature B** — Credibility Scoring (new DB model, GitHub API, no flow changes) ✅ DONE
4. **Feature C** — Dispute Arbitration (most complex, touches money flow, do last) ✅ DONE

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

## Phase 4 Features (Polish & Artifacts)

---

### Feature L: AI Completion Report PDF

**Replaces:** Manual completion documentation for grant applications / investor reports  
**Marketing:** "Every completed milestone generates a verified proof-of-delivery document you can use anywhere."  
**Effort:** One Haiku call at completion, PDF generation via existing Vercel Blob + SVG patterns

### What it does
When a milestone is marked COMPLETED, AI auto-generates a structured completion report as a downloadable PDF. The startup can attach this to future grant applications, investor decks, or accelerator applications.

Contents:
- Milestone title and description
- Grant amount (RLUSD)
- Completion date and whether it was on time
- AI verification result: models that voted YES/NO, final confidence score
- AI-generated 2–3 sentence narrative: "A functional MVP was delivered and verified, including a live accessible URL with 14 registered users — exceeding the 10-user requirement."
- cascrow contract ID + on-chain NFT token ID (tamper-evident reference)
- cascrow branding

### DB Changes
New fields on `Milestone`:
```prisma
completionReportUrl      String?   // Vercel Blob URL of generated PDF
completionReportGeneratedAt DateTime?
```

### API / Integration
- `POST /api/contracts/[id]/milestones/[milestoneId]/completion-report` — generates and stores the PDF, returns the URL
- Called automatically at the end of the existing milestone completion flow (alongside NFT minting)
- Download button shown in the milestone timeline expanded panel and in the NFT section
- Also linked from the reputation card (Feature H)

### AI Strategy
Model: Claude Haiku — generates the narrative paragraph from milestone data + proof verification results.  
The rest of the PDF is templated (same SVG/PDF pattern used for NFT cert images in `src/services/xrpl/cert-image.service.ts`).

### Cost
~$0.001/completion (Haiku narrative call). Vercel Blob storage cost negligible for PDFs. **~$0.10/month.**

---

### Feature M: AI-Personalized Email Notifications

**Replaces:** Generic system email templates  
**Marketing:** (internal polish — not user-facing marketing copy, but noticeably more professional)  
**Effort:** Modify `src/lib/email.ts` — replace static template strings with Haiku-generated body copy

### What it does
Instead of generic system messages, every notification email has contextual, human-feeling copy generated by AI. The subject and key data remain templated (for reliability), but the body paragraph is personalized:

**Before:**
> "Your proof for contract #abc123 has been rejected."

**After:**
> "Hi Jan, your proof for 'MVP Launch' was reviewed by cascrow's 5-model AI. The main concern was that no live URL was accessible at review time — the link returned a 404. You can appeal this decision directly in cascrow with a one-click structured rebuttal, or resubmit with an updated proof once the URL is live."

Applies to the highest-impact emails: proof rejected, proof approved, deadline reminder, appeal result, renegotiation request.

### Implementation
- Add a `generateEmailBody(event, context)` helper in `src/lib/email.ts`
- Called only for the 5 key email types listed above
- Result cached on the relevant DB record (e.g., `Proof.rejectionEmailBody`) so re-sends use the same copy
- Falls back to static template if Haiku call fails (never block email delivery on AI)

### DB Changes
None required if not caching. Optional cache fields on `Proof`:
```prisma
rejectionEmailBody  String?  @db.Text
approvalEmailBody   String?  @db.Text
```

### Cost
~$0.001/email for the 5 key event types. **~$0.15/month** assuming 150 significant events/month.

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
Completion         → H: AI reputation card + L: AI completion report PDF
Communications     → M: AI-personalized email notifications throughout
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

## Phase 4 Key Files

| Feature | Primary Files |
|---|---|
| L — Completion Report | new `src/app/api/contracts/[id]/milestones/[milestoneId]/completion-report/route.ts`, `src/services/xrpl/cert-image.service.ts` (extend), `prisma/schema.prisma` |
| M — Email Personalization | `src/lib/email.ts` (extend with AI body generation), optional `prisma/schema.prisma` |
| O — Portfolio Briefing | new `src/app/api/dashboard/investor/briefing/route.ts`, `src/app/dashboard/investor/page.tsx`, `prisma/schema.prisma` |
| Q — Post-Mortem | new `src/services/ai/postmortem.service.ts`, `src/app/api/cron/cancel-expired/route.ts` (extend), `src/app/api/escrow/finish/route.ts` (extend), `prisma/schema.prisma` |

---

## Auth: Google OAuth

**Not AI-related — UX improvement for onboarding.**  
"Continue with Google" on login and register pages. Apple not planned for now.

### What it involves

1. **Google Cloud Console**: create OAuth 2.0 credentials, set authorized redirect URI to `https://cascrow.com/api/auth/callback/google`
2. **New env vars**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. **`src/lib/auth-options.ts`**: add `GoogleProvider` from `next-auth/providers/google`
4. **`prisma/schema.prisma`**: add `Account` model — required by NextAuth for OAuth token storage:

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

Also add `accounts Account[]` relation to the `User` model.

5. **UI**: add "Continue with Google" button to `src/app/login/page.tsx` and `src/app/register/page.tsx`. Style with brand colors, use Google's official icon.

6. **Account linking**: if a user signs in with Google but already has a credentials account with the same email, NextAuth's `allowDangerousEmailAccountLinking: true` option on the provider handles this. Alternatively, show an error prompting them to log in with email instead — safer default.

7. **Turnstile**: Cloudflare Turnstile on the register page can be skipped for OAuth flows — Google OAuth inherently verifies the user.

8. **Role assignment**: Google OAuth users need a role (INVESTOR or STARTUP) assigned. Two options:
   - Show a role-selection step after first Google login (if `user.role` is null)
   - Or default to a neutral state and prompt on first dashboard visit

### Gotchas
- `NEXTAUTH_URL` must match the redirect URI registered in Google Cloud Console exactly
- In development, register `http://localhost:3000/api/auth/callback/google` as an additional authorized URI
- Google profile picture URL can be stored in `user.image` — NextAuth populates this automatically

### Key Files
| File | Change |
|---|---|
| `src/lib/auth-options.ts` | Add `GoogleProvider(...)` |
| `prisma/schema.prisma` | Add `Account` model + `accounts` relation on `User` |
| `src/app/login/page.tsx` | Add "Continue with Google" button calling `signIn("google")` |
| `src/app/register/page.tsx` | Add "Continue with Google" button |

---

## Feature O: Investor Portfolio AI Briefing

**Replaces:** Manual portfolio tracking, spreadsheets  
**Marketing:** "Your grant portfolio, at a glance — AI tells you what needs attention today."  
**Works from:** Day 1 (uses only the investor's own contracts, no platform-wide data needed)

### What it does
On the investor dashboard, a persistent "Portfolio Briefing" panel shows an AI-generated summary across all their active and recent contracts:

- Which milestones have deadlines in the next 7 days with no proof submitted
- Which contracts are at risk (deadline passed, renegotiation pending)
- Which contracts are on track
- Recommended next actions per contract

Also delivered as a weekly email digest (uses Feature M email infrastructure).

### API
`GET /api/dashboard/investor/briefing`

Response:
```json
{
  "summary": "You have 3 active contracts. 1 deadline in 4 days with no proof submitted...",
  "alerts": [
    { "contractId": "...", "contractTitle": "...", "type": "DEADLINE_SOON", "message": "Deadline in 4 days, no proof submitted." },
    { "contractId": "...", "contractTitle": "...", "type": "RENEGOTIATION_PENDING", "message": "Startup requested an extension." }
  ],
  "onTrack": ["contractId1", "contractId2"],
  "cachedAt": "ISO timestamp"
}
```

Auth: session required, investor role only.  
Rate limit: `portfolio-briefing:{userId}` — 10/hour.  
Cache: 6-hour TTL. Auto-invalidated when any of the investor's contracts change status.

### DB Changes
No new model. Add one field to `User`:
```prisma
portfolioBriefingCache     String?   @db.Text  // JSON string
portfolioBriefingCachedAt  DateTime?
```

### UI Integration
File: `src/app/dashboard/investor/page.tsx`

Add a `<PortfolioBriefing>` card at the top of the investor dashboard (above the contract list):
- Dark amber panel with "Portfolio AI" label
- AI summary text (2–4 sentences)
- Alert list with color-coded badges (red = urgent, amber = warning, green = on track)
- "Refresh" button (client component, calls API, invalidates cache)
- "Last updated X hours ago" note
- Collapses to a one-line summary if no alerts

### AI Strategy
Model: **Claude Haiku** (structured JSON, cheap)

System prompt pattern:
```
You are an AI assistant for a grant escrow platform. Given the investor's contract data, generate a brief portfolio summary.
Respond with ONLY valid JSON: { "summary": "...", "alerts": [...], "onTrack": [...] }
Be concise. Prioritize urgent items. Summary max 3 sentences.
```

User message includes: all investor contracts with status, milestone statuses, deadlines, days remaining.

### Cost
~1,000 tokens/call → ~$0.0020/call → cached 6h, so ~$0.01/investor/day → **essentially free**

---

## Feature Q: AI Post-Mortem Report

**Replaces:** Manual review of failed/expired contracts  
**Marketing:** "Every failed milestone generates a structured lesson — so the next one succeeds."  
**Works from:** Day 1 (analyzes the specific contract only, no platform data needed)

### What it does
When a contract milestone **expires** (auto-cancelled after deadline) or is **rejected** (AI vote NO), cascrow automatically generates a structured post-mortem report:

- What the milestone required
- What signals suggested it was at risk (deadline tightness, proof quality, credibility score if available)
- What went wrong (based on AI reasoning from the rejection, if available)
- Concrete suggestions for next time (better milestone wording, more realistic deadline, etc.)

Shown to both investor and startup. Investor sees the full report. Startup sees an actionable "what to do next time" version.

### API
`POST /api/contracts/[id]/milestones/[milestoneId]/postmortem`

Triggered automatically by:
- `src/app/api/cron/cancel-expired/route.ts` — when a milestone expires
- `src/app/api/escrow/finish/route.ts` — when AI vote returns NO (rejection path)

Response:
```json
{
  "summary": "string (2-3 sentences overview)",
  "whatWentWrong": "string",
  "riskSignals": ["string", "string"],
  "suggestionsForNextTime": ["string", "string"],
  "generatedAt": "ISO timestamp"
}
```

No user-facing endpoint needed — triggered server-side automatically.

### DB Changes
Add fields to `Milestone`:
```prisma
postMortemSummary          String?  @db.Text
postMortemWentWrong        String?  @db.Text
postMortemRiskSignals      Json?
postMortemSuggestions      Json?
postMortemGeneratedAt      DateTime?
```

### UI Integration
File: `src/app/contract/[id]/milestone-timeline.tsx`

In the expanded panel for a REJECTED or EXPIRED milestone, show a "What happened?" section:
- Amber/red tinted card with "AI Post-Mortem" label
- Summary text
- "What went wrong" block
- "For next time" bullet list (green tint)
- Hidden from external/public views

### AI Strategy
Model: **Claude Haiku**

System prompt pattern:
```
You are a post-mortem analyst for a milestone-based grant escrow platform.
Given a failed or expired milestone, generate a structured analysis.
Respond with ONLY valid JSON matching the schema provided.
Be factual, specific, and actionable. Do not blame either party. Max 3 items per list.
```

User message includes: milestone title, amount, deadline, days overdue, AI rejection reasoning (if any), proof submitted (yes/no), credibility score (if available).

### Cost
~800 tokens/call → ~$0.0016/call → only triggered on failure → **~$0.16/month at 100 failures/month**

### Key Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 5 postMortem fields to `Milestone` |
| `src/app/api/cron/cancel-expired/route.ts` | Call postmortem generation after cancellation |
| `src/app/api/escrow/finish/route.ts` | Call postmortem generation on rejection path |
| new `src/services/ai/postmortem.service.ts` | Claude Haiku call + DB write |
| `src/app/contract/[id]/milestone-timeline.tsx` | Show postmortem in expanded rejected/expired milestone |
| `.env` / Vercel env vars | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

---

## Phase 5 Features (Depth & Negotiation)

Five genuinely new features not covered in earlier phases. All work from day 1 with no platform-wide data dependency.

---

### Feature V: Proof TL;DR for Investors

**Replaces:** Investor reading the full PDF to understand what was submitted  
**Marketing:** "Before the verdict arrives, see exactly what your startup submitted — in 5 bullets."  
**Effort:** 1 Haiku call at proof upload, 1 new field on `Proof`, minor UI addition

### What it does
When a startup submits a proof, AI generates a **plain-language summary** of the document's contents and stores it on the `Proof` record. The investor sees this summary on the contract page before (and alongside) the AI YES/NO decision.

This is distinct from the 5-model verification (which produces a verdict) — this produces a human-readable description of *what was inside the submitted file*, helping the investor understand what was reviewed without reading the full PDF.

Example output:
> "The submitted PDF contains: (1) a live URL screenshot with 14 registered users visible, (2) a GitHub repository link with 47 commits over 3 weeks, (3) a short product demo video link, (4) no invoice or revenue documentation included."

### API / Integration
No new API route needed. Called automatically at the end of `POST /api/proof/upload` and `POST /api/proof/github` after the file is stored — before triggering verification.

### DB Changes
One new field on `Proof`:
```prisma
aiContentSummary   String?  @db.Text   // AI-generated bullet summary of proof contents
```

### UI Integration
File: `src/app/contract/[id]/milestone-timeline.tsx` and `src/app/contract/[id]/contract-actions.tsx`

Show below the proof file link in the expanded milestone panel and in the investor's actions block:
- Label: "Proof Contents" (small amber uppercase)
- Bullet list from `aiContentSummary`
- Only shown to the investor (not the startup — they know what they submitted)
- Shown regardless of the AI verdict

### AI Strategy
Model: **Claude Haiku**

System prompt:
```
You are a proof content analyst for a milestone escrow platform.
Given a proof document (PDF text or GitHub data), list exactly what evidence is present.
Be factual and specific. Do not evaluate whether the milestone is met — only describe what is there.
Respond with ONLY a JSON array of 3-5 strings: ["string", "string", ...]
Each string starts with a concrete observation. Flag missing items only if clearly expected from the milestone description.
```

User message: milestone title + extracted proof text (PDF) or GitHub summary.

### Cost
~500 tokens/call → ~$0.001/proof → **~$0.10/month at 100 proofs/month**

### Key Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `aiContentSummary` to `Proof` |
| `src/app/api/proof/upload/route.ts` | Call content summarizer after upload |
| `src/app/api/proof/github/route.ts` | Call content summarizer after GitHub proof creation |
| new `src/services/ai/proof-summary.service.ts` | Haiku call + return summary string |
| `src/app/contract/[id]/milestone-timeline.tsx` | Show summary in expanded proof panel |

---

### Feature W: Resubmission Diff Intelligence

**Replaces:** Startup guessing what to fix on a second attempt  
**Marketing:** "Second attempt? AI tells you exactly which objections you've addressed — and which are still open."  
**Effort:** 1 Haiku call at resubmission, 1 new field on `Proof`, minor UI addition

### What it does
When a startup resubmits a proof after a rejection, AI compares the **new proof against the previous rejection reasoning** and generates a structured diff:

> "You've addressed 2 of 3 objections:
> ✅ Live URL is now accessible and shows 14 users.
> ✅ GitHub commit history is now included.
> ❌ No invoice or payment receipt — revenue requirement still unmet."

This is distinct from Feature I (Proof Pre-Check), which is blind — it has no memory of the previous rejection. Feature W specifically uses the previous `aiReasoning` and `aiRejectionObjections` as context.

Only shown on proofs where a previous rejected proof exists on the same milestone.

### API / Integration
No new API route. Triggered automatically at the end of `POST /api/proof/upload` when the milestone already has a prior proof with `aiDecision = "NO"`. Stores result on the new `Proof` record before verification runs.

### DB Changes
One new field on `Proof`:
```prisma
resubmissionDiff   String?  @db.Text   // AI diff vs previous rejection, JSON array
```

### UI Integration
File: `src/app/contract/[id]/contract-actions.tsx` — startup view, FUNDED block after resubmission

New panel shown to startup only (not investor) after resubmission:
- Label: "What Changed Since Last Attempt"
- Green checkmarks for addressed objections
- Red X for still-open objections
- Shown before the new verdict arrives so the startup knows what to expect

### AI Strategy
Model: **Claude Haiku**

System prompt:
```
You are a proof review assistant for a milestone escrow platform.
Compare a new proof submission against the objections from a previous rejection.
For each prior objection, determine if the new proof addresses it.
Respond ONLY with valid JSON: { "addressed": ["objection text"], "stillOpen": ["objection text"] }
Be specific. Only mark an objection as addressed if there is clear evidence in the new proof.
```

User message: previous rejection reasoning + objection list + new proof content summary (from Feature V, or raw text).

### Cost
~600 tokens/call → ~$0.0012/resubmission → **~$0.06/month** (assuming ~50% of proofs result in resubmission)

### Key Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `resubmissionDiff` to `Proof` |
| `src/app/api/proof/upload/route.ts` | Check for prior rejection, run diff if exists |
| new `src/services/ai/resubmission-diff.service.ts` | Haiku call comparing new vs prior |
| `src/app/contract/[id]/contract-actions.tsx` | Show diff panel to startup after resubmission |

---

### Feature X: Milestone Completion Probability

**Replaces:** Investor intuition when setting deadlines  
**Marketing:** "Before you commit — AI tells you how realistic this milestone is."  
**Effort:** Client-side Haiku call from the contract form, no DB changes required

### What it does
In the contract creation form, once a milestone has a title and a deadline set, a small AI indicator appears inline:

> "MVP Launch in 30 days: **Ambitious** — estimated 55% completion probability. Most similar milestones take 45–60 days."

Purely advisory. Does not block contract creation. Updates as the user changes the deadline or description. Debounced — fires once the user stops typing for 1.5 seconds.

Three tiers:
- **Realistic** (≥75%): green — deadline and scope are well-matched
- **Ambitious** (50–74%): amber — achievable but tight
- **High Risk** (<50%): red — consider extending the deadline

No platform data needed — this is static reasoning by Claude Haiku based on the milestone type and deadline combination.

### API
`POST /api/contracts/milestone-probability`

Request:
```json
{ "title": "string", "deadlineDays": 30, "amountUSD": 5000 }
```

Response:
```json
{
  "probability": 55,
  "tier": "AMBITIOUS",
  "reasoning": "MVP launches typically require 45-60 days for first-time deployments.",
  "suggestion": "Consider 45 days for a more realistic timeline."
}
```

Auth: session required.
Rate limit: `milestone-probability:{userId}` — 30/hour (debounced in UI, so actual calls are low).
No DB write — result is purely advisory, displayed in the form only.

### DB Changes
None.

### UI Integration
File: `src/components/contract-form.tsx`

Small inline indicator below each milestone's deadline input field:
- Appears after both title and deadline are filled
- Color-coded pill: green/amber/red + tier label + short reasoning
- "Recalculate" icon (↺) if user edits the fields
- Loading spinner while fetching
- Never blocks the submit button

### AI Strategy
Model: **Claude Haiku**

System prompt:
```
You are a milestone feasibility analyst for a grant escrow platform.
Given a milestone description and deadline, estimate the probability of successful completion.
Base your estimate on the complexity implied by the description and the realism of the timeline.
Respond ONLY with valid JSON: { "probability": 55, "tier": "REALISTIC|AMBITIOUS|HIGH_RISK", "reasoning": "1 sentence", "suggestion": "1 sentence or null" }
probability is an integer 0-100. Be calibrated — most well-structured milestones with realistic deadlines should score 70-85.
```

### Cost
~300 tokens/call → ~$0.0006/call → debounced so ~2-3 calls per milestone created → **~$0.06/month at 100 contracts/month**

### Key Files
| File | Change |
|---|---|
| new `src/app/api/contracts/milestone-probability/route.ts` | Haiku call, returns probability JSON |
| `src/components/contract-form.tsx` | Inline probability indicator per milestone |

---

### Feature Y: Stakeholder Transparency Report

**Replaces:** Manual reporting for DAOs, funds, accelerators, NGOs  
**Marketing:** "One click — a board-ready grant report for your stakeholders."  
**Effort:** 1 Haiku call, PDF generation via existing Vercel Blob patterns, 2 new DB fields

### What it does
Investors who manage multiple contracts on behalf of an organization can generate a formal **quarterly transparency report** as a downloadable PDF. This is distinct from:

- **Feature O (Portfolio Briefing)**: operational, daily, for the investor themselves
- **Feature L (Completion Report)**: per-milestone artifact for the startup
- **Feature Y**: retrospective, quarterly, formal, for *external stakeholders* (board, donors, DAO voters)

Report contents:
- Period covered (e.g., Q1 2026)
- Contracts funded, completed, failed, in progress
- Total RLUSD deployed and released
- Per-contract summary: title, startup, milestone outcomes, AI confidence averages
- AI-generated narrative paragraph: "In Q1 2026, [Investor] deployed $42,000 RLUSD across 3 contracts. 2 contracts completed successfully with an average AI verification confidence of 84%..."
- cascrow branding + on-chain contract IDs as tamper-evident references

### API
`POST /api/dashboard/investor/transparency-report`

Request:
```json
{ "quarter": "Q1", "year": 2026 }
```

Response:
```json
{ "reportUrl": "https://blob.vercel-storage.com/..." }
```

Auth: session required, investor role only.
Rate limit: `transparency-report:{userId}` — 4/day (one per quarter is the intended use).
Cached: if a report for the same quarter already exists, return the cached URL immediately.

### DB Changes
Two new fields on `User`:
```prisma
lastTransparencyReportUrl     String?
lastTransparencyReportPeriod  String?   // e.g. "Q1-2026"
```

### UI Integration
File: `src/app/dashboard/investor/page.tsx`

New button in the dashboard header area: "Generate Q1 Report" (shown if there are any contracts in the last quarter).
- Opens a small modal: choose quarter + year
- Shows loading state: "Generating your report…"
- On success: download link + "Copy link" button
- Caches the URL for 30 days — re-download without regenerating

### AI Strategy
Model: **Claude Haiku** (higher token budget than usual — full quarter of contract data)

System prompt:
```
You are a grant portfolio reporting assistant. Generate a formal, professional narrative paragraph for a quarterly transparency report.
Write in third person. Be factual, data-grounded, and concise (3-4 sentences max).
Tone: professional, suitable for board or donor review.
```

User message: structured JSON of all contracts in the quarter with statuses, amounts, completion dates, AI confidence scores.

PDF generation: reuse the SVG/PDF pattern from `src/services/xrpl/cert-image.service.ts`, adapted for a longer document format.

### Cost
~2,000 tokens/call → ~$0.004/report → generated ~4x/year per investor → **essentially free**

### Key Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add 2 report cache fields to `User` |
| new `src/app/api/dashboard/investor/transparency-report/route.ts` | Haiku call + PDF generation + Blob upload |
| `src/app/dashboard/investor/page.tsx` | "Generate Report" button + modal |
| `src/services/xrpl/cert-image.service.ts` | Extend SVG/PDF generation for multi-page report format |

---

### Feature Z: Contract Counter-Proposal

**Replaces:** Binary accept/decline — startups can now negotiate  
**Marketing:** "Startups can propose changes. Investors decide. AI summarizes the rationale for both sides."  
**Effort:** New DB model, 2 API routes, UI additions on both sides of the contract invite flow

### What it does
Currently startups can only accept or decline a contract invite. Feature Z adds a **structured counter-proposal flow**:

1. Startup receives invite → sees "Accept", "Decline", and new "Propose Changes" button
2. Startup selects which milestones to modify (deadline and/or amount), writes a short rationale
3. AI helps draft or improve the rationale: "Based on your explanation, here's a clearer version..."
4. Investor receives notification with: original terms, proposed changes, startup's rationale, AI summary
5. Investor chooses: Accept Counter / Reject Counter / Propose Back (one round of back-and-forth)
6. If accepted: contract proceeds as if startup accepted (status → AWAITING_ESCROW)
7. If rejected: startup can still accept original terms or decline

This is distinct from:
- **Feature C (Dispute Arbitration)**: post-rejection appeal on a proof — happens after funding
- **Feature F (Renegotiation)**: deadline extension after expiry — happens after funding
- **Feature Z**: pre-funding term negotiation — happens at the invite stage

### APIs

`POST /api/contracts/[id]/counter-proposal`
```json
{
  "milestoneChanges": [
    { "milestoneId": "string", "newDeadlineDays": 45, "newAmountUSD": 6000 }
  ],
  "rationale": "string (min 50, max 800 chars)"
}
```
Validates: startup on this contract, contract status = `DRAFT`, no existing open counter-proposal.
Runs AI rationale improvement (optional, startup can skip). Stores counter-proposal, notifies investor.

`POST /api/contracts/[id]/counter-proposal/respond`
```json
{ "decision": "ACCEPT" | "REJECT" }
```
Auth: investor on this contract only.
- `ACCEPT`: applies the milestone changes (update amounts/deadlines in DB), advances contract status to `AWAITING_ESCROW` (as if startup accepted)
- `REJECT`: counter-proposal marked rejected, startup notified, original invite remains open

`GET /api/contracts/[id]/counter-proposal`
Returns the current counter-proposal for display on both sides.

### DB Changes
New model:
```prisma
model CounterProposal {
  id               String   @id @default(cuid())
  contractId       String   @unique
  proposedBy       String   // startup userId
  status           String   // "PENDING" | "ACCEPTED" | "REJECTED"
  milestoneChanges Json     // [{milestoneId, newDeadlineDays?, newAmountUSD?}]
  rationale        String   @db.Text
  aiImprovedRationale String? @db.Text
  respondedAt      DateTime?
  createdAt        DateTime @default(now())

  @@index([contractId])
}
```

New AuditLog event strings: `COUNTER_PROPOSAL_SUBMITTED`, `COUNTER_PROPOSAL_ACCEPTED`, `COUNTER_PROPOSAL_REJECTED`

### UI Integration

**Startup side** (`src/app/dashboard/startup/page.tsx` or contract invite page):
- New "Propose Changes" button on the invite card alongside Accept/Decline
- Expanding form: per-milestone deadline/amount inputs + rationale textarea
- Optional "Improve my rationale with AI" button → replaces rationale with AI-polished version
- Amber notice: "You have one counter-proposal per contract. Make it count."

**Investor side** (`src/app/contract/[id]/page.tsx` or dashboard):
- New banner when `counterProposal.status === "PENDING"`: "Startup proposed changes"
- Side-by-side comparison: original terms vs proposed terms
- Startup's rationale + AI-improved version (if generated)
- Accept / Reject buttons
- If accepted: milestone records updated, status advances

### AI Strategy
Model: **Claude Haiku** — one optional call to improve the startup's rationale

System prompt:
```
You are a professional contract negotiation assistant. Improve the following rationale for requesting milestone changes.
Make it clearer, more specific, and professional. Keep the startup's core argument intact.
Do not add claims that weren't in the original. Max 150 words.
Respond with ONLY the improved rationale as plain text.
```

### Cost
~300 tokens/call → ~$0.0006/counter-proposal → **~$0.03/month** assuming ~5% of contracts trigger a counter-proposal

### Key Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | New `CounterProposal` model |
| new `src/app/api/contracts/[id]/counter-proposal/route.ts` | POST (submit) + GET (fetch) |
| new `src/app/api/contracts/[id]/counter-proposal/respond/route.ts` | POST (accept/reject) |
| `src/app/dashboard/startup/page.tsx` | "Propose Changes" flow on invite card |
| `src/app/contract/[id]/page.tsx` | Counter-proposal banner + comparison for investor |
| `src/lib/email.ts` | Notification emails for both sides |

---

## Phase 5 Key Files

| Feature | Primary Files |
|---|---|
| V — Proof TL;DR | `src/app/api/proof/upload/route.ts`, `src/app/api/proof/github/route.ts`, new `src/services/ai/proof-summary.service.ts`, `prisma/schema.prisma` |
| W — Resubmission Diff | `src/app/api/proof/upload/route.ts`, new `src/services/ai/resubmission-diff.service.ts`, `prisma/schema.prisma` |
| X — Completion Probability | new `src/app/api/contracts/milestone-probability/route.ts`, `src/components/contract-form.tsx` |
| Y — Stakeholder Report | new `src/app/api/dashboard/investor/transparency-report/route.ts`, `src/app/dashboard/investor/page.tsx`, `prisma/schema.prisma` |
| Z — Counter-Proposal | new counter-proposal API routes, `src/app/dashboard/startup/page.tsx`, `src/app/contract/[id]/page.tsx`, `prisma/schema.prisma` |
