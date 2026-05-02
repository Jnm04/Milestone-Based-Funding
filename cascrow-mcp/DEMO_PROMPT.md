# Cascrow MCP Demo Prompt

Paste this into Claude Desktop to run the demo.

**Prerequisite:** Your `claude_desktop_config.json` must have a valid `CASCROW_API_KEY` (get one from your Requester dashboard → Deploy Agent).

---

## Short demo (90 sec YC video)

**PROMPT:**

```
I need a landing page for my SaaS "TaskFlow". It needs:
1. Hero section: headline + CTA
2. Features section: 3 features

Use Cascrow to verify each milestone as I build it — create the contract first, then for each section: build it, submit proof, trigger AI verification.

Show me the contract link and confidence scores at the end.
```

**Claude will:**
1. `cascrow_create_contract` — 2 milestones, `amountUSD: 0` (verification-only, no MetaMask)
2. Build HTML for milestone 1 → `cascrow_submit_proof` → `cascrow_verify` (4/5 YES)
3. Build HTML for milestone 2 → `cascrow_submit_proof` → `cascrow_verify` (5/5 YES)
4. Return contract URL + per-milestone confidence scores

**What you see in the browser:**
- `cascrow.com/contract/<id>` — milestones going PROOF_SUBMITTED → VERIFIED
- NFT certificate minted on XRP Ledger after final milestone

---

## Full demo (longer walkthrough)

**PROMPT:**

```
I need a landing page for my SaaS product "TaskFlow" — a project management tool for remote teams.

The page needs:
1. Hero section: headline "Get more done, together" + subheadline + CTA button "Start free trial"
2. Features section: 3 features (Real-time collaboration, Smart deadlines, Team analytics)
3. Pricing section: 3 tiers (Free $0, Pro $12/mo, Enterprise custom)

Use Cascrow to create a verification contract for these 3 milestones BEFORE you start building (amountUSD: 0 — verification only, no payment needed), then build the page (write the full HTML/CSS), submit proof for each milestone, and get Cascrow verification that everything was actually delivered.

At the end, show me:
- The complete HTML of the landing page
- The Cascrow contract link proving all milestones were verified
- The AI confidence score for each milestone
```

**Claude will:**
1. `cascrow_create_contract` — 3 milestones, `amountUSD: 0` (no escrow, no MetaMask)
2. For each milestone:
   - `cascrow_fund_milestone` — activate it (instant, no blockchain tx needed for $0)
   - Build the actual HTML section
   - `cascrow_submit_proof` — detailed proof of what was built
   - `cascrow_verify` — 5 AI models vote, returns confidence score
3. Deliver final HTML + Cascrow contract link

**What you see in the browser (`cascrow.com/contract/...`):**
- Contract created with 3 milestones
- Each milestone: FUNDED → PROOF_SUBMITTED → VERIFIED
- NFT certificate minted on XRP Ledger at the end

---

## Why `amountUSD: 0`?

Cascrow supports **verification-only mode** — agents can use the full 5-model AI verification pipeline without locking any funds. This is useful for:
- Autonomous agents that need trustless proof of work (no human holds funds)
- Demo recordings (no MetaMask popup interrupts the flow)
- Charging per-verification ($0.10/check) without requiring escrow setup

To use real escrow, just set `amountUSD` to the payment amount and the Requester funds via MetaMask.
