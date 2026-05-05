"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Terminal,
  Zap,
  GitBranch,
  CreditCard,
  Webhook,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { EscrowFlowDiagram } from "@/components/guide/EscrowFlowDiagram";
import { DualChainDiagram } from "@/components/guide/DualChainDiagram";
import { AgenticPipelineDiagram } from "@/components/guide/AgenticPipelineDiagram";

/* ---------------------------------------------------------------------------
   CopyField
--------------------------------------------------------------------------- */
const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="flex flex-col gap-1.5 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="font-mono text-[12px] text-foreground break-all">{value}</code>
        <button
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   CodeBlock
--------------------------------------------------------------------------- */
const CodeBlock = ({ language, code }: { language: string; code: string }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="my-5 overflow-hidden rounded-xl border border-border bg-[hsl(24_14%_3%)]">
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(0_60%_55%)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(45_70%_55%)]/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-[hsl(140_50%_55%)]/70" />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{language}</span>
        </div>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed" style={{ color: "hsl(32 35% 92%)" }}>
        <code style={{ color: "inherit", background: "none", padding: 0, borderRadius: 0 }}>{code}</code>
      </pre>
    </div>
  );
};

/* ---------------------------------------------------------------------------
   Network params
--------------------------------------------------------------------------- */
const network: { label: string; value: string }[] = [
  { label: "Network name", value: "XRPL EVM Testnet" },
  { label: "RPC URL", value: "https://rpc.testnet.xrplevm.org" },
  { label: "Chain ID", value: "1449000" },
  { label: "Currency symbol", value: "XRP" },
  { label: "Block explorer", value: "https://explorer.testnet.xrplevm.org" },
];

/* ---------------------------------------------------------------------------
   Step types & StepCard
--------------------------------------------------------------------------- */
type Step = { num: string; title: string; body: React.ReactNode };

const StepCard = ({ step, i }: { step: Step; i: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.55, delay: Math.min(i * 0.04, 0.25) }}
    className="gradient-border group rounded-2xl bg-card/60 p-7 backdrop-blur-md"
  >
    <div className="flex items-start gap-5">
      <div className="flex flex-col items-center">
        <div className="font-mono text-3xl font-semibold text-gradient-copper">{step.num}</div>
        <div className="mt-2 h-full w-px bg-gradient-to-b from-primary/30 to-transparent" />
      </div>
      <div className="flex-1 pb-1">
        <h3 className="text-xl font-semibold tracking-tight text-foreground">{step.title}</h3>
        <div className="mt-3 text-sm text-muted-foreground leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ol]:my-4 [&_ol]:space-y-1 [&_ol]:pl-0 [&_li]:text-sm [&_li]:text-muted-foreground [&_a]:text-primary [&_a:hover]:underline [&_code]:text-primary [&_code]:text-[12px] [&_code]:bg-primary/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
          {step.body}
        </div>
      </div>
    </div>
  </motion.div>
);

/* ---------------------------------------------------------------------------
   Human steps
--------------------------------------------------------------------------- */
const humanSteps: Step[] = [
  {
    num: "01",
    title: "Install MetaMask",
    body: (
      <>
        <p>Install the MetaMask browser extension from the official site.</p>
        <p>
          <a href="https://metamask.io/download" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            Download MetaMask <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <p>Create a new wallet and store your seed phrase safely — even on testnet, treat it as practice for mainnet habits.</p>
      </>
    ),
  },
  {
    num: "02",
    title: "Add the XRPL EVM Testnet to MetaMask",
    body: (
      <>
        <p>Cascrow runs on the XRPL EVM Sidechain Testnet. Add it as a custom network:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Open MetaMask → click the network dropdown at the top</li>
          <li>2. &quot;Add a custom network&quot; → &quot;Add a network manually&quot;</li>
          <li>3. Fill in the fields below, then click Save</li>
        </ol>
        <div className="my-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border">
          {network.map((n) => <CopyField key={n.label} label={n.label} value={n.value} />)}
        </div>
        <p className="text-primary">✓ MetaMask switches to &quot;XRPL EVM Testnet&quot; and shows your XRP balance.</p>
      </>
    ),
  },
  {
    num: "03",
    title: "Get testnet XRP for gas fees",
    body: (
      <>
        <p>You need a small amount of XRP on the EVM Sidechain to pay for gas:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Join the XRPL EVM Discord</li>
          <li>2. Go to the #faucet channel</li>
          <li>3. Type: <code>!faucet 0x…</code> (your MetaMask address)</li>
          <li>4. Receive ~90 XRP within 2 minutes — enough for hundreds of tx</li>
        </ol>
        <p>
          <a href="https://discord.gg/xrplevm" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            Join XRPL EVM Discord <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </>
    ),
  },
  {
    num: "04",
    title: "Add MockRLUSD to MetaMask",
    body: (
      <>
        <p>MockRLUSD is the testnet version of RLUSD — a fake USD-pegged token you can mint freely for testing. Add it as a custom token:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. In MetaMask, scroll down and click &quot;Import tokens&quot;</li>
          <li>2. Select &quot;Custom token&quot;</li>
          <li>3. Paste the contract address below</li>
          <li>4. Symbol (RLUSD) and decimals (6) auto-fill</li>
          <li>5. Click &quot;Add custom token&quot; → &quot;Import tokens&quot;</li>
        </ol>
        <div className="my-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border">
          <CopyField label="MockRLUSD contract" value="0xF717cC3a7ae4a8839e7d964B64A622Dae523a348" />
          <CopyField label="Token symbol" value="RLUSD" />
          <CopyField label="Decimals" value="6" />
        </div>
        <p className="text-primary">✓ MockRLUSD now shows up with a balance of 0. Next step gives you tokens.</p>
      </>
    ),
  },
  {
    num: "05",
    title: "Mint MockRLUSD tokens",
    body: (
      <>
        <p>The MockRLUSD contract has an open mint function — anyone can call it to get test tokens. Easiest path is via the block explorer:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Open the MockRLUSD contract on the block explorer</li>
          <li>2. Click the &quot;Write contract&quot; tab</li>
          <li>3. Click &quot;Connect wallet&quot; — connect your MetaMask</li>
          <li>4. Find the <code>mint</code> function</li>
          <li>5. Enter your address + amount (e.g. <code>10000000000</code> = 10,000 RLUSD)</li>
          <li>6. Click &quot;Write&quot; and confirm in MetaMask</li>
        </ol>
        <p>
          <a href="https://explorer.testnet.xrplevm.org/address/0xF717cC3a7ae4a8839e7d964B64A622Dae523a348" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
            Open MockRLUSD on Explorer <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <p className="text-xs text-muted-foreground">6 decimals: <code>1000000</code> = 1 RLUSD · <code>10000000000</code> = 10,000 RLUSD</p>
      </>
    ),
  },
  {
    num: "06",
    title: "Register on Cascrow",
    body: (
      <>
        <p>Both Requester and Builder need a Cascrow account. Takes under a minute:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Go to <code>cascrow.com/register</code></li>
          <li>2. Email + password + role (Requester or Builder)</li>
          <li>3. Verify your email</li>
          <li>4. Log in</li>
        </ol>
        <p>For a full end-to-end test you need two accounts (two emails or two browsers) — one Requester, one Builder.</p>
      </>
    ),
  },
  {
    num: "07",
    title: "Connect your MetaMask wallet",
    body: (
      <>
        <p>After logging in, link your wallet so Cascrow knows which address signs:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Open your Dashboard</li>
          <li>2. Click &quot;Connect Wallet&quot; — MetaMask pops up</li>
          <li>3. Pick the account and confirm</li>
          <li>4. Your <code>0x…</code> address appears on your profile</li>
        </ol>
      </>
    ),
  },
  {
    num: "08",
    title: "Create a contract (Requester)",
    body: (
      <>
        <p>As Requester you define the milestone and payout:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Click &quot;New Contract&quot; on your dashboard</li>
          <li>2. Title + clear milestone description (the AI verifies against this)</li>
          <li>3. Set RLUSD amount and deadline in days</li>
          <li>4. Builder wallet address — or leave blank for a shareable invite</li>
          <li>5. Click &quot;Create Contract&quot;</li>
        </ol>
        <p><strong className="text-foreground">Be specific.</strong> The AI reads the milestone description to decide if proof meets criteria.</p>
      </>
    ),
  },
  {
    num: "09",
    title: "Fund the escrow (Requester)",
    body: (
      <>
        <p>Once both parties are linked, lock the RLUSD on-chain:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Open the contract detail page</li>
          <li>2. Click &quot;Fund Escrow&quot; — MetaMask opens with two transactions</li>
          <li>3. Approve MockRLUSD spending</li>
          <li>4. <code>fundMilestone()</code> locks the tokens in the escrow contract</li>
          <li>5. Status flips to &quot;Funded&quot;</li>
        </ol>
        <p className="text-primary">✓ RLUSD is locked at <code>0x7d0B1119c3b2b6e9aAc025ae6A051C67eF40d8c4</code>. Neither party can access it without AI approval.</p>
      </>
    ),
  },
  {
    num: "10",
    title: "Submit proof (Builder)",
    body: (
      <>
        <p>As the Builder, upload evidence that the milestone is done:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Log in with the Builder account, open the contract</li>
          <li>2. Click &quot;Upload Proof&quot;</li>
          <li>3. Upload a PDF describing what was delivered</li>
          <li>4. Submit — AI verification starts automatically</li>
        </ol>
        <p>Address the milestone criteria clearly. Vague or unrelated content gets rejected.</p>
      </>
    ),
  },
  {
    num: "11",
    title: "AI verification & settlement",
    body: (
      <>
        <p>Five AI models independently read the proof and vote. Result is immediate:</p>
        <ol className="my-4 space-y-1 pl-6 text-sm text-muted-foreground">
          <li>1. Watch contract status — updates in real time</li>
          <li>2. 3/5 YES + high confidence → funds released to Builder automatically</li>
          <li>3. Medium confidence (60–85%) → Requester reviews manually</li>
          <li>4. 3/5 NO → Builder is notified with reason and can resubmit</li>
          <li>5. Deadline passes → Requester cancels, full refund</li>
        </ol>
        <p className="text-primary">✓ On approval, an NFT completion certificate is minted on the XRP Ledger mainnet — visible on testnet.xrpl.org.</p>
      </>
    ),
  },
];

/* ---------------------------------------------------------------------------
   Agentic
--------------------------------------------------------------------------- */
const agenticCaps = [
  { icon: KeyRound, title: "API Key auth", body: "Generate a csk_… key in your profile. Any HTTP client or agent framework can authenticate." },
  { icon: GitBranch, title: "GitHub connector", body: "Link a repo per milestone. The proof collector fetches commits 48h before deadline." },
  { icon: CreditCard, title: "Stripe connector", body: "Link your Stripe key. Revenue data is encrypted, collected, and included in the proof." },
  { icon: Terminal, title: "MCP protocol", body: "Native Claude Code tool. Run npx cascrow-mcp and call cascrow_mcp_submit." },
  { icon: Zap, title: "On-chain release", body: "Approved evidence triggers releaseMilestone on XRPL EVM — funds in 3-5s." },
  { icon: Webhook, title: "Webhook events", body: "Subscribe to funds.released to trigger downstream logic in your treasury." },
];

const agenticSteps: Step[] = [
  {
    num: "A",
    title: "Generate an API Key",
    body: (
      <p>
        Go to <strong className="text-foreground">Profile → Integrations → API Keys</strong> and click &quot;Generate API Key&quot;. Copy the <code>csk_…</code> token — shown only once.
      </p>
    ),
  },
  {
    num: "B",
    title: "Connect agent connectors on a milestone",
    body: (
      <p>
        When creating a contract, open <strong className="text-foreground">Configure Agent Connectors</strong> in a milestone block. Paste your GitHub repo URL and/or Stripe secret key. 48h before the deadline the collector runs automatically — Requester confirms with one click.
      </p>
    ),
  },
  {
    num: "C",
    title: "Call the MCP endpoint from your agent",
    body: (
      <>
        <p>Any AI agent, CI pipeline, or script can submit evidence and trigger verification with one call:</p>
        <CodeBlock
          language="bash"
          code={`curl -X POST https://cascrow.com/api/mcp/submit \\
  -H "Authorization: Bearer csk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contract_id": "YOUR_CONTRACT_ID",
    "evidence": {
      "description": "Shipped v1.0 — 47 commits, live at app.example.com",
      "links": ["https://github.com/you/repo", "https://app.example.com"],
      "github_commit": "abc1234",
      "revenue_amount": 5000
    }
  }'`}
        />
      </>
    ),
  },
  {
    num: "D",
    title: "Or use the CLI — for shells, CI, and scripts",
    body: (
      <>
        <p><code>cascrow-cli</code> wraps all agent endpoints in a single binary — no SDK, no boilerplate. Works from any shell, GitHub Action, or subprocess.</p>
        <CodeBlock
          language="shell"
          code={`npm install -g cascrow-cli

cascrow register --email bot@example.com --password secret123
export CASCROW_API_KEY=csk_...

cascrow create --title "Fix auth bug — all tests must pass" --days 7
cascrow fund --contract cm_abc123
cascrow verify --contract cm_abc123 \\
  --proof "Fixed JWT expiry in auth.ts, 42 tests green, PR #51 merged" \\
  --commit abc1234

# ✅ VERIFIED (94% confidence)
# Proof: https://cascrow.com/proof/...`}
        />
      </>
    ),
  },
];

const autonomousFacts = [
  "5 AI models vote in parallel (Claude, GPT-4o, Gemini, Mistral, Cerebras)",
  "Confidence >85% + majority YES → RLUSD released on XRPL EVM automatically",
  "NFT certificate minted on XRP Ledger mainnet",
  "funds.released webhook fires to your downstream systems",
  "Public proof page with QR code + LinkedIn share generated",
  "Model weights adjusted weekly via feedback loop cron",
];

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
type TabKey = "agent" | "architecture" | "human";

export default function GuidePage() {
  const [tab, setTab] = useState<TabKey>("agent");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "agent", label: "Agentic mode" },
    { key: "architecture", label: "Architecture" },
    { key: "human", label: "Human flow" },
  ];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteNav activePage="Guide" />

      {/* HERO */}
      <section className="relative pt-36 pb-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] opacity-70"
          style={{ background: "radial-gradient(ellipse at top, hsl(22 70% 35% / 0.35), transparent 60%)" }}
        />

        <div className="container-tight">
          <Link
            href="/"
            className="group mb-10 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            cd ../
          </Link>

          {/* Terminal header */}
          <div className="mb-10 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
            <span className="text-muted-foreground">cascrow ~/guide</span>
            <span className="text-primary">›</span>
            <span className="text-foreground">testnet --start</span>
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Testnet Guide
            </div>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-[-0.025em] text-gradient md:text-7xl">
              Get started on testnet.
            </h1>
            <p className="mt-7 text-lg text-muted-foreground">
              Everything you need to run your first escrow on Cascrow — pick how deep you want to go: let an agent handle it, dive into the architecture, or do it yourself.
            </p>
          </motion.div>

          {/* Tab switcher */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-10 inline-flex flex-wrap items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur-md"
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-all ${
                  tab === t.key
                    ? "bg-gradient-copper text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* AGENTIC */}
      <section id="agentic" className={`relative pb-24 scroll-mt-24 ${tab === "agent" ? "" : "hidden"}`}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] opacity-50"
          style={{ background: "radial-gradient(ellipse at center top, hsl(28 70% 35% / 0.3), transparent 70%)" }}
        />
        <div className="container-tight max-w-4xl">
          <div className="mb-2 flex items-center gap-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Live now · Agentic mode</span>
          </div>
          <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-gradient md:text-5xl">
            Let agents do the work.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Connect any AI agent to Cascrow via MCP. It submits evidence, the 5-model pipeline verifies, and RLUSD is released on-chain — no human in the loop.
          </p>

          <div className="mt-12">
            <AgenticPipelineDiagram />
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agenticCaps.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="gradient-border rounded-xl bg-card/60 p-5 backdrop-blur-md transition-colors hover:bg-card/80"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </div>
                <div className="mt-4 text-sm font-semibold text-foreground">{c.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-14 space-y-5">
            {agenticSteps.map((s, i) => <StepCard key={s.num} step={s} i={i} />)}
          </div>

          {/* Autonomous facts */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-10 gradient-border rounded-2xl bg-card/60 p-7 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">What happens — fully autonomous</span>
            </div>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {autonomousFacts.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Claude Desktop / MCP config */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-8 gradient-border rounded-2xl bg-card/60 p-7 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Claude Desktop / Claude Code</span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Install via npm — then add to your MCP config:</p>
            <CodeBlock
              language="json"
              code={`npx cascrow-mcp

# claude_desktop_config.json:
{
  "mcpServers": {
    "cascrow": {
      "command": "npx",
      "args": ["cascrow-mcp"],
      "env": { "CASCROW_API_KEY": "csk_..." }
    }
  }
}`}
            />
            <p className="mt-3 text-[13px] text-muted-foreground">
              Tools: <code className="text-primary text-[12px] bg-primary/10 px-1.5 py-0.5 rounded">cascrow_create_contract</code> · <code className="text-primary text-[12px] bg-primary/10 px-1.5 py-0.5 rounded">cascrow_mcp_submit</code> · <code className="text-primary text-[12px] bg-primary/10 px-1.5 py-0.5 rounded">cascrow_verify</code>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href="/api-docs#agent-api"
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-7 py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              API Docs
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-gradient-copper px-7 py-3.5 text-sm font-medium text-primary-foreground glow-on-hover"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <button
              onClick={() => setTab("human")}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-7 py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              Prefer manual? Switch to Human flow
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" className={`relative pb-24 scroll-mt-24 ${tab === "architecture" ? "" : "hidden"}`}>
        <div className="container-tight max-w-4xl">
          <div className="mb-2 flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Architecture</span>
          </div>
          <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.02em] text-gradient md:text-5xl">
            How the protocol works.
          </h2>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            Under the hood: how funds are escrowed, how AI verifies proof, and why Cascrow uses two chains in parallel.
          </p>
          <div className="mt-12 space-y-6">
            <EscrowFlowDiagram />
            <DualChainDiagram />
          </div>
        </div>
      </section>

      {/* HUMAN FLOW */}
      <section id="human-flow" className={`relative pb-24 scroll-mt-24 ${tab === "human" ? "" : "hidden"}`}>
        <div className="container-tight max-w-3xl">
          <div className="mb-10 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-gradient-to-r from-primary to-transparent" />
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Human flow · 11 steps</span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Do it yourself.</h2>
            </div>
          </div>

          <div className="space-y-5">
            {humanSteps.map((s, i) => <StepCard key={s.num} step={s} i={i} />)}
          </div>

          {/* You're set */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-12 gradient-border rounded-2xl bg-card/60 p-8 text-center backdrop-blur-md"
          >
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">You&apos;re set.</h3>
            <p className="mt-3 text-muted-foreground">
              That&apos;s the full human flow. Questions? Open an issue or reach out — we&apos;re happy to help.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-copper px-7 py-3.5 text-sm font-medium text-primary-foreground glow-on-hover"
              >
                Create your first contract
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button
                onClick={() => setTab("agent")}
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-7 py-3.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                Building with agents?
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
