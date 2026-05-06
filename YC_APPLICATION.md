# YC Application — Cascrow
# Batch: F2026 | Deadline: 2026-05-04

---

## Company name
Cascrow

## Describe what your company does in 50 characters or less
Escrow for the agent economy.

## Company URL
https://cascrow.com

---

## What is your company going to make?

Cascrow is infrastructure for agents, not a tool for humans that agents can also use. An agent registers with one API call, creates a contract in one tool call, submits proof in another, and receives a cryptographic verdict — no browser, no MetaMask, no human in the loop.

Under the hood: we lock RLUSD in a smart contract on the XRPL EVM Sidechain and release it automatically when a 5-model AI majority vote confirms the milestone was completed — 3/5 YES across Claude, GPT-4o, Gemini, Mistral, and Qwen3. No single vendor controls the verdict.

Two modes: escrow mode (funds locked on-chain, released on AI consensus) and verification-only mode ($0.10/check — agents get a cryptographic, NFT-backed completion record for any deliverable without touching escrow).

Three machine-readable interfaces: REST API, MCP server (cascrow-mcp on npm — natively callable from Claude Desktop, Cursor, and any MCP-compatible agent framework), and a CLI (cascrow-cli on npm — `cascrow verify --proof "..."` from any shell or subprocess). Agents discover, sign up for, and use Cascrow entirely programmatically.

Trust is the largest unmonetized expense in the global economy. Every outcome-based payment pays a tax to humans whose only job is to say "yes, it happened." We're replacing that tax with code — and building the settlement layer the agent economy needs before the large platforms lock it in themselves.

---

## Where do you live now, and where would the company be based after YC?
Frankfurt, Germany / San Francisco, United States

## Explain your decision regarding location

We are based in Frankfurt, Germany. After YC we would relocate to San Francisco.

Germany positions itself as a leading AI nation but the infrastructure for it doesn't exist here — no density of AI-native founders, no serious seed ecosystem for infrastructure plays, and a regulatory environment that slows rather than enables. The conversations we need to have — with AI labs, with agent platform teams, with the investors who understand what the agent economy requires — are happening in San Francisco, not Frankfurt.

San Francisco specifically because our customers and partners are there: Anthropic (our MCP server is built on their tooling), the teams building agentic frameworks, and the early enterprise buyers who are already deploying AI agents at scale. Distribution in this market is relationship-driven and moves fast. We need to be in the room.

YC is the trigger for the move. The network, the batch, and the proximity to the right people justify the relocation completely.

---

## How far along are you?

Live at cascrow.com. Built in 10 weeks at the XRPL Student Builder Residency Spring 2026, presented at Demo Day in April 2026.

Full stack deployed: smart contracts on XRPL EVM Sidechain, 5-model AI verification pipeline (Claude, GPT-4o-mini, Gemini, Mistral, Qwen3 running in parallel), non-transferable NFT completion certificates on native XRP Ledger mainnet, dual-chain audit trail. Three agent-native interfaces: REST API, MCP server (cascrow-mcp on npm — natively callable from Claude Desktop, Cursor, any MCP-compatible agent), and CLI (cascrow-cli on npm). Agents register, create contracts, submit proof, and trigger verification entirely programmatically — no human in the loop.

14 registered users on testnet. We are running testnet deliberately — we're finalizing a structured pilot with 50 committed participants from our network before moving real money. They are founders, developers, and freelancers actively using AI agents for work who want independent verification that the output is real.

---

## How long have each of you been working on this? How much of that has been full-time?

Both founders since February 18, 2026 — roughly 10 weeks, both full-time. We built the initial version during the XRPL Student Builder Residency Spring 2026 and presented at Demo Day in April 2026. After Demo Day we continued full-time: expanded the product from pure escrow to the full agentic verification use case, added the MCP server, the CLI, programmatic agent registration (no email verification required — agents get an API key in one POST call), and the agent-to-agent infrastructure (API key auth, per-model vote streaming, on-chain reputation endpoint).

---

## What tech stack are you using, or planning to use? Include AI models and AI coding tools.

Next.js (App Router), TypeScript, PostgreSQL + Prisma, Vercel, Upstash Redis.

Blockchain: XRPL EVM Sidechain (Solidity smart contracts, RLUSD escrow), native XRP Ledger mainnet (NFTokenMint certificates, AccountSet audit memos — dual-chain trail). MetaMask for wallet signing via EIP-1193.

AI verification: Claude Haiku 4.5, GPT-4o-mini, Gemini 2.5 Flash, Mistral Small, Qwen3 via Cerebras — all five run in parallel, 3/5 majority required. No single AI vendor controls the verdict.

AI coding: Claude Code (Anthropic's CLI). I use it as my primary implementation tool — I architect and spec every feature with precise constraints, Claude Code implements, I review and validate everything before it ships. It's how a two-person non-engineering team ships production-grade infrastructure — smart contracts, 5-model AI pipeline, dual-chain audit trail, MCP server, CLI, programmatic agent registration — in 10 weeks.

---

## Are people using your product?
Yes

## How many active users or customers do you have? How many are paying? Who is paying you the most, and how much do they pay you?

14 registered users on testnet. No paying customers yet — revenue is not live. We are running testnet deliberately: we want to validate verification quality and UX before moving real money. We have 50 committed pilot participants from our personal and professional network — founders, developers, and freelancers actively using AI agents for work — who will participate in our structured pilot launching in the next 4 weeks. That pilot is our path to first paying users.

## Do you have revenue?
No

---

## If you have already participated or committed to participate in an incubator, "accelerator" or "pre-accelerator" program, please tell us about it.

XRPL Student Builder Residency Spring 2026 — a program by Ripple supporting student builders on the XRP Ledger ecosystem. We presented at Demo Day in April 2026. After Demo Day we evolved the thesis: the original idea was milestone-based escrow for human contractors. We realized the more important problem — and the right timing — is the agent economy. Agents are already transacting. They need a verification and settlement layer that works without MetaMask, without human arbitrators, and without trusting any single AI vendor. That pivot sharpened the product significantly.

---

## Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?

We ran the 35th EBS Symposium — Europe's largest student-organized business conference, with 150+ corporate partners. We inherited the organization with a €100,000 deficit and had to move fast. Every contract had milestone-based deliverables: social posts, on-site activations, brand placements. Nearly every deadline slipped — because verifying whether something was actually done required someone to manually check Instagram, count impressions, confirm placement. We felt this problem with real money and real pressure.

That was the origin. Then we saw where AI agents are heading: agents are already writing code, designing assets, running campaigns. The same verification problem we had with humans is about to get worse with agents — because agents can produce convincing proof of work that was never actually done. A single ChatGPT call saying "milestone complete" is not a verdict. A 3/5 vote across five independent AI labs, locked on two blockchains, is.

We know people need this because we needed it. And the pilots we're running now confirm it — the use case we hear most is: "I hired an AI agent to do X, how do I know it actually happened?"

---

## Who are your competitors? What do you understand about your business that they don't?

Traditional escrow (Escrow.com, Upwork): human arbitrators, days of delay, no API, no path to autonomous agent transactions.

Smart contract escrow (Kleros, Aragon): token-holder jurors — slow, expensive for small transactions, not designed for AI-generated deliverables.

AI code review tools (Codium, DeepSource): verify code quality, not contractual completion. They tell you if tests pass, not if the agreed spec was met.

What we understand that none of them do: the primary customer in three years is not a human freelancer — it's an AI agent with an API key. And for agent-to-agent transactions, you need verification that is independent of both parties, multi-model (no single vendor trusted by both sides), and cryptographically anchored on a public ledger. A 3/5 consensus across Anthropic, Google, OpenAI, Mistral, and Alibaba is manipulation-resistant in a way that no single-provider or human-review system can be. We are building the settlement layer for the agent economy, not a better version of Escrow.com.

---

## How do or will you make money? How much could you make?

0.5% protocol fee on successful escrow releases — we only earn when work is verified and funds actually move. Incentives aligned with the builder.

$0.10 per verification in verification-only mode — no escrow required. Designed for AI agents and automated pipelines that need proof-of-completion at volume.

Later: Reviewer-as-a-Service — domain experts for high-value or disputed milestones, €50–2,000 per review.

TAM: Global outcome-based payments (grants, subsidies, performance contracts) represent over $3.5T annually. Agent-to-agent payments don't have a market size yet — because the market doesn't exist yet. We are building the primitive that makes it possible.

---

## What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?

Professor Raša Karapandža — Dean of EBS Business School, Professor of Finance, Visiting Professor at NYU, and Co-Director of the NYU Center for Technology, Economics and Development — reviewed what we were building after Demo Day and told us directly: apply to YC now. He's not someone who says that about student projects. He has worked at BlackRock, Berkshire Hathaway, and Renaissance Technologies, advises members of the US Congress on digital assets, and has been publishing research on blockchain and AI in finance for years. When he says a fintech infrastructure idea has the right timing and thesis, that means something.

Beyond the recommendation: the window is real. AI agents are entering the economy in 2026. The infrastructure for autonomous agent transactions — verified delivery, programmable settlement, on-chain reputation — needs to be built in the next 12–18 months before the large platforms lock in their own closed systems. YC is where the founders and investors building the agent economy are concentrated. We want to be in that room before that window closes.

---

## How did you hear about Y Combinator?

YC has been a reference point since we started studying entrepreneurship at EBS. We followed the YC blog, Hacker News, and startup school materials through the EBS entrepreneurship program. The XRPL Builder Residency Demo Day in April 2026 made the timing concrete — we had a live product, a defensible thesis, and a direct recommendation from Professor Karapandža to apply now.

---

## Who writes code, or does other technical work on your product? Was any of it done by a non-founder? Please explain.

I write all code using Claude Code (Anthropic's AI coding CLI) as my primary tool. My co-founder leads business development, partnerships, and go-to-market. No external engineers or contractors.

I make every architectural decision, specify every feature with precise constraints and security requirements, and review every implementation before it ships. Claude Code compresses execution time dramatically — the full stack (smart contracts, 5-model AI pipeline, dual-chain audit trail, MCP server) was built and deployed in 10 weeks by one person.

This is also a product proof point: if Claude Code can help a non-engineer ship production infrastructure at this quality, it validates exactly the kind of AI-assisted work our platform is built to verify.

---

## Are you looking for a cofounder?

We are open to a technical co-founder who has deep experience in smart contract security or AI infrastructure — specifically someone who has shipped production systems at the intersection of on-chain settlement and AI. Not actively recruiting, but if YC has the right person in the network, we'd have the conversation.
