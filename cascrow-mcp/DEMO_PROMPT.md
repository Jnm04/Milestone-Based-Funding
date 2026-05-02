# Cascrow MCP Demo Prompt

Paste this into Claude Desktop to run the demo:

---

**PROMPT:**

```
I need a landing page for my SaaS product "TaskFlow" — a project management tool for remote teams.

The page needs:
1. Hero section: headline "Get more done, together" + subheadline + CTA button "Start free trial"
2. Features section: 3 features (Real-time collaboration, Smart deadlines, Team analytics)
3. Pricing section: 3 tiers (Free $0, Pro $12/mo, Enterprise custom)

Use Cascrow to create a verification contract for these 3 milestones BEFORE you start building, then build the page (write the full HTML/CSS), submit proof for each milestone, and get Cascrow verification that everything was actually delivered.

At the end, show me:
- The complete HTML of the landing page
- The Cascrow contract link proving all milestones were verified
- The AI confidence score for each milestone
```

---

## What Claude will do automatically:

1. `cascrow_create_contract` — 3 milestones, each with acceptance criteria
2. For each milestone:
   - `cascrow_fund_milestone` — activate it
   - Build the actual HTML section
   - `cascrow_submit_proof` — detailed proof of what was built
   - `cascrow_verify` — 5 AI models vote, returns confidence score
3. Deliver final HTML + Cascrow verification links

## What you see in the browser (cascrow.com/contract/...):
- Contract created with 3 milestones
- Each milestone going FUNDED → PROOF_SUBMITTED → VERIFIED
- NFT certificate minted on XRP Ledger at the end
