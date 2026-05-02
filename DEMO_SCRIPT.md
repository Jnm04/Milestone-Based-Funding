# Cascrow — YC Demo Video Script (3 minutes)

**Format:** Screen recording with voiceover + subtitles  
**Structure:** Problem (30s) → Act 1: AI Agent earns (75s) → Act 2: Real money moves (60s) → Outro (15s)

---

## SETUP (before recording, not in video)

- Two browser tabs ready:
  - Tab A: `cascrow.com/contract/<id-act1>` — a fresh verification-only contract, status `DRAFT`
  - Tab B: `cascrow.com/contract/<id-act2>` — a funded escrow contract, status `FUNDED`, milestone: *"Integrate Stripe checkout into the SaaS billing page"*, amount: **50 RLUSD**
- Claude Desktop open, MCP configured with API key
- Terminal/Claude Desktop on the left, browser on the right
- Screen resolution clean, notifications off, browser bookmarks bar hidden

---

## PART 0 — THE PROBLEM (0:00–0:30)

**[Screen: Black. No UI.]**

> 🎙️ *"Every year, trillions of dollars change hands based on trust."*

**[Screen: Slowly fade in — a generic Slack message: "Hey, looks good to me 👍" as an approval]**

> 🎙️ *"A manager approves a Slack message. A grant committee reads a PDF no one checks. A freelancer gets paid because someone said so."*

**[Screen: Cut to a calendar — 30-day payment terms, overdue]**

> 🎙️ *"The entire system runs on social trust. And social trust fails constantly."*

**[Screen: Cut to cascrow.com landing page — hero text: "The escrow layer for the agent economy"]**

> 🎙️ *"We built Cascrow — because in the age of AI agents, trust needs to be cryptographic."*

**[Subtitle: CASCROW — AI-verified escrow on the XRP Ledger]**

---

## PART 1 — AN AI AGENT EARNS ITS FIRST PAYCHECK (0:30–1:45)

**[Screen: Full screen — Claude Desktop]**

> 🎙️ *"This is a Claude agent. We're going to give it a real job."*

**[You type into Claude Desktop — show the typing live:]**

```
You are a frontend developer agent. 

Build a hero section for a SaaS called TaskFlow:
- Headline: "Ship tasks faster, together"
- Subheadline: "The project tool built for async teams"  
- CTA button: "Start free"

Use Cascrow to verify your work when done.
Contract ID: csc_abc123
```

**[Subtitle: Agent receives job. No human will approve this — the blockchain will.]**

**[Screen: Watch Claude Desktop — show tool calls appearing one by one]**

Claude calls `cascrow_get_contract`:
```json
{ "milestone": "Hero section with CTA", "status": "FUNDED" }
```

> 🎙️ *"The agent reads the contract. Acceptance criteria are locked on-chain — no one can change them retroactively."*

**[Screen: Claude builds the code — show it writing HTML/JSX for ~10 seconds at 1.5x speed]**

> 🎙️ *"It builds. Then it writes its own proof report."*

**[Screen: Claude calls `cascrow_submit_proof` — show the tool call]**

```
Submitting proof: "Hero section implemented at /components/Hero.tsx.
Headline 'Ship tasks faster, together' present. CTA button renders
at 320px and 1440px. Lighthouse accessibility score: 98."
```

**[Subtitle: Proof submitted. SHA-256 hash written to the XRP Ledger.]**

**[Screen: SPLIT — Left: Claude Desktop. Right: Browser on contract page]**

> 🎙️ *"Now — five AI models from five different companies vote."*

**[Screen: Claude calls `cascrow_verify`. Right side browser shows status flipping to PROOF_SUBMITTED]**

**[Left side: Vote stream appears line by line — slow enough to read:]**

```
✅ Claude (Anthropic):      YES — 96%
✅ Gemini (Google):         YES — 91%  
✅ GPT-4o-mini (OpenAI):    YES — 94%
✅ Mistral Small (Mistral): YES — 88%
✅ Qwen3 (Cerebras):        YES — 92%
```

**[Right side: Contract page refreshes — status badge flips from PROOF_SUBMITTED → VERIFIED → vote grid appears with 5 green checkmarks → NFT certificate card fades in]**

> 🎙️ *"Five models. Five different companies. Three of five required. No single provider controls the outcome."*

**[Subtitle: 5/5 approved. Cryptographic proof minted on the XRP Ledger. Forever.]**

**[Screen: Zoom into the NFT certificate on the right side — show "AI VERIFIED" badge]**

> 🎙️ *"The agent just earned a verifiable, on-chain completion certificate. Its first receipt — provably, permanently."*

---

## PART 2 — REAL MONEY MOVES. NO HUMANS INVOLVED. (1:45–2:45)

**[Screen: Wipe transition. Full screen — browser on Tab B: contract with 50 RLUSD, status FUNDED]**

> 🎙️ *"Now real money is on the line."*

**[Subtitle: 50 RLUSD locked in a smart contract on the XRPL EVM Sidechain]**

**[Screen: Zoom into the contract detail — show milestone title "Integrate Stripe checkout", amount 50 RLUSD, status FUNDED, smart contract address visible]**

> 🎙️ *"A founder locked 50 RLUSD in a smart contract. The release condition: a working Stripe integration. The contract enforces this on-chain — Cascrow cannot redirect the funds, the founder cannot pull them back early, no one can change the criteria."*

**[Screen: Switch back to Claude Desktop — full screen]**

**[You type:]**

```
The Stripe milestone is funded and waiting.
Here is the codebase context: [attached]

Complete the Stripe checkout integration and 
submit proof to Cascrow. Contract ID: csc_xyz789.
```

**[Screen: Claude works — show it calling `cascrow_get_contract`, reading milestone criteria, writing code — 1.5x speed, ~15 seconds]**

**[Subtitle: Agent reads on-chain criteria. Builds. No manager approving. No invoice. No net-30.]**

**[Screen: SPLIT — Left: Claude Desktop. Right: Browser on contract page (status: FUNDED)]**

**[Left: Claude calls `cascrow_submit_proof`]**

> 🎙️ *"Proof submitted. Now the vote."*

**[Left: Vote stream — live:]**

```
✅ Claude (Anthropic):      YES — 94%
✅ Gemini (Google):         YES — 89%
✅ GPT-4o-mini (OpenAI):    YES — 93%
✅ Mistral Small (Mistral): YES — 91%
✅ Qwen3 (Cerebras):        YES — 95%
```

**[Right: Status flips FUNDED → VERIFIED → COMPLETED. A new row appears:]**

```
FUNDS_RELEASED   50 RLUSD → 0x4a7c…b1e9   ✓ on-chain
```

**[NFT certificate appears. EVM transaction hash visible.]**

**[Subtitle: Funds released. On-chain. Automatic. The agent earned it.]**

> 🎙️ *"No invoice. No approval email. No escrow agent taking 3%. The smart contract released the money the moment five AI models agreed the work was done."*

**[Screen: Brief pause on the completed contract — both the transaction hash and the NFT visible simultaneously]**

> 🎙️ *"Every step — the criteria, the proof file, the AI votes, the transaction — is permanently on two independent blockchains. Anyone can verify it. Forever."*

---

## OUTRO (2:45–3:00)

**[Screen: Slow zoom out from contract → fade to cascrow.com landing page]**

> 🎙️ *"This is the infrastructure layer the agent economy needs."*

**[Subtitle fades in:]**

```
Agents deliver.
AI verifies.  
Funds move.

No humans required.
```

**[Final frame: cascrow.com — logo + tagline for 3 seconds]**

---

## PRODUCTION NOTES

**Pacing:**
- Part 0: Slow, let the problem land. Don't rush.
- Part 1 code-writing: 1.5x speed is fine — viewers understand "agent is working"
- Vote streams: **1x, never speed up** — this is the strongest visual moment
- Status transitions in browser: 1x — the flip from FUNDED → COMPLETED is the payoff

**Audio:**
- Voiceover: calm, confident, not salesy. Think "this is obvious, let me show you."
- No background music during vote streams — silence makes the ticking-in votes more dramatic
- Optional: subtle ambient under Part 0 problem setup only

**Subtitles:**
- Always on — assume muted autoplay on YC's end
- White text, dark background pill, bottom center
- Key terms bold: **RLUSD**, **XRP Ledger**, **5-model vote**

**What NOT to show:**
- MetaMask popups (fund the escrow contract before recording)
- Login / registration screens
- Any loading spinners longer than 2 seconds (retry if testnet is slow)
- The internal admin panel

**Backup plan if testnet is slow:**
- Record Part 1 (verification-only) live — no blockchain dependency, always fast
- For Part 2, pre-record the vote stream + status transition and cut it in at 1x speed
- The story is identical — viewers cannot tell the difference
