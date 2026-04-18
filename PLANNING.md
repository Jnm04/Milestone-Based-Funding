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

## Total Cost Estimate

All 4 features combined: **under $1/month at 100 contracts/month**  
All on existing API keys (Anthropic), no new paid services, GitHub public API is free.

---

## Key Files to Edit

| Feature | Primary Files |
|---|---|
| A — AI Drafting | `src/components/contract-form.tsx`, new `src/app/api/contracts/draft/route.ts` |
| B — Credibility | `src/app/contract/[id]/page.tsx`, new `src/app/api/contracts/[id]/credibility/route.ts`, `prisma/schema.prisma` |
| C — Dispute | `src/app/contract/[id]/contract-actions.tsx`, new `src/app/api/proof/[proofId]/appeal/route.ts`, `src/services/ai/verifier.service.ts` (add objection generation), `prisma/schema.prisma` |
| D — Guidance | `src/app/contract/[id]/contract-actions.tsx`, new `src/app/api/contracts/[id]/milestones/[milestoneId]/guidance/route.ts`, `prisma/schema.prisma` |
| All | `src/app/stats/page.tsx`, `src/app/page.tsx` (landing), `src/lib/zod-schemas.ts` (new schemas) |
