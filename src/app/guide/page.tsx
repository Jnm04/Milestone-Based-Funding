"use client";

import React from "react";
import Link from "next/link";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

const RLUSD_ADDRESS = "0xF717cC3a7ae4a8839e7d964B64A622Dae523a348";
const ESCROW_ADDRESS = "0x7d0B1119c3b2b6e9aAc025ae6A051C67eF40d8c4";
const CHAIN_ID = "1449000";
const RPC_URL = "https://rpc.testnet.xrplevm.org";
const EXPLORER_URL = "https://explorer.testnet.xrplevm.org";
const FAUCET_URL = "https://faucet.xrplevm.org";


function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      style={{
        fontSize: "11px",
        padding: "3px 10px",
        borderRadius: "6px",
        background: "hsl(22 55% 54% / 0.1)",
        border: "1px solid hsl(22 55% 54% / 0.25)",
        color: "hsl(22 55% 54%)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(196,112,75,0.2)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "hsl(22 55% 54% / 0.1)")}
    >
      Copy
    </button>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderRadius: "10px", background: "hsl(24 14% 4% / 0.4)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
        <span style={{ fontSize: "10px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <code style={{ fontSize: "13px", color: "hsl(32 35% 92%)", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</code>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: "hsl(22 55% 54% / 0.12)", border: "1px solid hsl(22 55% 54% / 0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "14px", fontWeight: 700, color: "hsl(22 55% 54%)",
    }}>{n}</div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <ScrollReveal delay={(n - 1) * 60}>
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <StepBadge n={n} />
          <div style={{ width: 1, flex: 1, background: "hsl(22 55% 54% / 0.15)", marginTop: 8 }} />
        </div>
        <div style={{ flex: 1, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ fontWeight: 600, fontSize: 20, color: "hsl(32 35% 92%)", marginTop: 6 }}>{title}</h3>
          {children}
        </div>
      </div>
    </ScrollReveal>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: "10px", background: "hsl(22 55% 54% / 0.06)", border: "1px solid hsl(22 55% 54% / 0.18)", fontSize: "13px", color: "hsl(30 10% 62%)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", fontSize: "13px", color: "hsl(30 10% 62%)", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "14px", color: "hsl(30 10% 62%)", lineHeight: 1.75 }}>{children}</p>;
}

function Ol({ items }: { items: string[] }) {
  return (
    <ol style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: "14px", color: "hsl(30 10% 62%)", lineHeight: 1.7, listStyleType: "decimal" }}>{item}</li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  return (
    <main style={{ minHeight: "100vh", background: "hsl(24 14% 4%)", color: "hsl(32 35% 92%)" }}>

      <SiteNav activePage="Guide" />

      {/* Hero */}
      <section className="py-24 pt-36 px-6 text-center" style={{ position: "relative", zIndex: 1 }}>
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "hsl(22 55% 54%)" }}>Testnet Guide</p>
          <h1
            className="tracking-tight"
            style={{ fontWeight: 600, fontSize: "clamp(36px, 6vw, 58px)", color: "hsl(32 35% 92%)" }}
          >
            Get started on testnet
          </h1>
          <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: "hsl(30 10% 62%)" }}>
            Everything you need to set up MetaMask, get test tokens, and run your first escrow — step by step.
          </p>
        </ScrollReveal>
      </section>

      {/* Architecture diagram */}
      <section className="px-6 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-widest mb-8 text-center" style={{ color: "hsl(22 55% 54%)" }}>How it works</p>

            {/* Flow diagram */}
            <div style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.14)", borderRadius: 16, padding: "32px 24px", marginBottom: 24 }}>
              <p className="text-sm font-semibold mb-6 text-center" style={{ color: "hsl(30 10% 62%)", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}>Escrow Flow</p>
              <svg viewBox="0 0 700 120" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto" }}>
                {/* Nodes */}
                {[
                  { x: 30, label: "Requester", sub: "Creates contract" },
                  { x: 175, label: "Builder", sub: "Accepts invite" },
                  { x: 320, label: "Escrow", sub: "RLUSD locked" },
                  { x: 465, label: "AI Vote", sub: "5-model consensus" },
                  { x: 610, label: "Settlement", sub: "Funds released" },
                ].map(({ x, label, sub }, i) => (
                  <g key={i}>
                    <rect x={x} y={20} width={90} height={56} rx={10} fill="rgba(196,112,75,0.08)" stroke="hsl(22 55% 54% / 0.3)" strokeWidth={1} />
                    <text x={x + 45} y={46} textAnchor="middle" fontSize={12} fontWeight={600} fill="hsl(32 35% 92%)" fontFamily="sans-serif">{label}</text>
                    <text x={x + 45} y={62} textAnchor="middle" fontSize={9} fill="hsl(30 10% 62%)" fontFamily="sans-serif">{sub}</text>
                  </g>
                ))}
                {/* Arrows */}
                {[120, 265, 410, 555].map((x, i) => (
                  <g key={i}>
                    <line x1={x} y1={48} x2={x + 55} y2={48} stroke="rgba(196,112,75,0.4)" strokeWidth={1.5} />
                    <polygon points={`${x + 55},44 ${x + 63},48 ${x + 55},52`} fill="rgba(196,112,75,0.4)" />
                  </g>
                ))}
                {/* Step labels below arrows */}
                {[
                  { x: 120, text: "Invite" },
                  { x: 265, text: "Fund" },
                  { x: 410, text: "Proof" },
                  { x: 555, text: "Verify" },
                ].map(({ x, text }, i) => (
                  <text key={i} x={x + 32} y={92} textAnchor="middle" fontSize={9} fill="#6B5E52" fontFamily="sans-serif">{text}</text>
                ))}
              </svg>
            </div>

            {/* Dual-chain architecture */}
            <div style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.14)", borderRadius: 16, padding: "32px 24px" }}>
              <p className="text-sm font-semibold mb-6 text-center" style={{ color: "hsl(30 10% 62%)", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 11 }}>Dual-Chain Architecture</p>
              <svg viewBox="0 0 700 200" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto" }}>
                {/* Center: Cascrow platform */}
                <rect x={270} y={72} width={160} height={56} rx={12} fill="hsl(22 55% 54% / 0.12)" stroke="rgba(196,112,75,0.45)" strokeWidth={1.5} />
                <text x={350} y={98} textAnchor="middle" fontSize={13} fontWeight={700} fill="hsl(32 35% 92%)" fontFamily="sans-serif">Cascrow</text>
                <text x={350} y={115} textAnchor="middle" fontSize={9.5} fill="hsl(30 10% 62%)" fontFamily="sans-serif">AI · Escrow logic · Database</text>

                {/* Left: XRPL EVM Sidechain */}
                <rect x={28} y={60} width={170} height={80} rx={12} fill="rgba(59,130,246,0.07)" stroke="rgba(59,130,246,0.3)" strokeWidth={1} />
                <text x={113} y={90} textAnchor="middle" fontSize={11} fontWeight={700} fill="#93C5FD" fontFamily="sans-serif">XRPL EVM Sidechain</text>
                <text x={113} y={106} textAnchor="middle" fontSize={9} fill="#6B7280" fontFamily="sans-serif">MilestoneFundEscrow.sol</text>
                <text x={113} y={120} textAnchor="middle" fontSize={9} fill="#6B7280" fontFamily="sans-serif">RLUSD (ERC-20) · MetaMask</text>

                {/* Right: XRPL Mainnet */}
                <rect x={502} y={60} width={170} height={80} rx={12} fill="rgba(52,211,153,0.07)" stroke="rgba(52,211,153,0.3)" strokeWidth={1} />
                <text x={587} y={90} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6EE7B7" fontFamily="sans-serif">XRPL Mainnet</text>
                <text x={587} y={106} textAnchor="middle" fontSize={9} fill="#6B7280" fontFamily="sans-serif">NFTokenMint (non-transferable)</text>
                <text x={587} y={120} textAnchor="middle" fontSize={9} fill="#6B7280" fontFamily="sans-serif">AccountSet audit memos</text>

                {/* Arrows left */}
                <line x1={198} y1={100} x2={268} y2={100} stroke="rgba(59,130,246,0.4)" strokeWidth={1.5} strokeDasharray="4 3" />
                <polygon points="268,96 276,100 268,104" fill="rgba(59,130,246,0.5)" />
                <text x={233} y={92} textAnchor="middle" fontSize={8.5} fill="#6B7280" fontFamily="sans-serif">fund / release</text>

                {/* Arrows right */}
                <line x1={430} y1={100} x2={500} y2={100} stroke="rgba(52,211,153,0.4)" strokeWidth={1.5} strokeDasharray="4 3" />
                <polygon points="500,96 508,100 500,104" fill="rgba(52,211,153,0.5)" />
                <text x={465} y={92} textAnchor="middle" fontSize={8.5} fill="#6B7280" fontFamily="sans-serif">mint NFT / audit</text>

                {/* Labels bottom */}
                <text x={113} y={163} textAnchor="middle" fontSize={9} fill="#4B5563" fontFamily="sans-serif">Chain ID 1449000 (testnet)</text>
                <text x={350} y={163} textAnchor="middle" fontSize={9} fill="#4B5563" fontFamily="sans-serif">Vercel · PostgreSQL · Upstash</text>
                <text x={587} y={163} textAnchor="middle" fontSize={9} fill="#4B5563" fontFamily="sans-serif">s1.ripple.com · mainnet</text>
              </svg>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Steps */}
      <section className="px-6 pb-32" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-2xl mx-auto">

          {/* ── Step 1 ── */}
          <Step n={1} title="Install MetaMask">
            <P>If you don&apos;t have MetaMask yet, install the browser extension from the official site.</P>
            <a
              href="https://metamask.io/download"
              target="_blank"
              rel="noopener noreferrer"
              className="cs-btn-primary cs-btn-sm"
              style={{ alignSelf: "flex-start" }}
            >
              Download MetaMask →
            </a>
            <InfoBox>
              Create a new wallet and store your seed phrase safely — even on testnet, treat it as practice for mainnet habits.
            </InfoBox>
          </Step>

          {/* ── Step 2 ── */}
          <Step n={2} title="Add the XRPL EVM Testnet to MetaMask">
            <P>Cascrow runs on the XRPL EVM Sidechain Testnet. Add it as a custom network in MetaMask:</P>
            <Ol items={[
              'Open MetaMask → click the network dropdown at the top',
              '"Add a custom network" → "Add a network manually"',
              'Fill in the fields below, then click Save',
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px", borderRadius: "14px", background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.14)" }}>
              <CodeRow label="Network name" value="XRPL EVM Testnet" />
              <CodeRow label="RPC URL" value={RPC_URL} />
              <CodeRow label="Chain ID" value={CHAIN_ID} />
              <CodeRow label="Currency symbol" value="XRP" />
              <CodeRow label="Block explorer" value={EXPLORER_URL} />
            </div>
            <SuccessBox>
              ✓ After saving, MetaMask will switch to &quot;XRPL EVM Testnet&quot; and show your XRP balance (0 for now).
            </SuccessBox>
          </Step>

          {/* ── Step 3 ── */}
          <Step n={3} title="Get testnet XRP for gas fees">
            <P>You need a small amount of XRP on the EVM Sidechain to pay for gas. The easiest way is via the XRPL EVM Discord:</P>
            <Ol items={[
              'Join the XRPL EVM Discord (link below)',
              'Go to the #faucet channel',
              'Type: !faucet 0x… (your MetaMask address)',
              'You\'ll receive 90 XRP within ~2 minutes — enough for hundreds of transactions',
            ]} />
            <a
              href="https://discord.gg/xrplevm"
              target="_blank"
              rel="noopener noreferrer"
              className="cs-btn-primary cs-btn-sm"
              style={{ alignSelf: "flex-start" }}
            >
              Join XRPL EVM Discord →
            </a>
            <InfoBox>
              This XRP is testnet-only and has no real value — it&apos;s purely for paying gas fees on the XRPL EVM Sidechain.
            </InfoBox>
          </Step>

          {/* ── Step 4 ── */}
          <Step n={4} title="Add MockRLUSD to MetaMask">
            <P>MockRLUSD is the testnet version of RLUSD — a fake USD-pegged token you can mint freely for testing. Add it as a custom token so it shows up in your MetaMask wallet:</P>
            <Ol items={[
              'In MetaMask, scroll down and click "Import tokens"',
              'Select "Custom token"',
              'Paste the contract address below',
              'Token symbol (RLUSD) and decimals (6) fill in automatically',
              'Click "Add custom token" → "Import tokens"',
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px", borderRadius: "14px", background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.14)" }}>
              <CodeRow label="MockRLUSD contract address" value={RLUSD_ADDRESS} />
              <CodeRow label="Token symbol" value="RLUSD" />
              <CodeRow label="Decimals" value="6" />
            </div>
            <SuccessBox>
              ✓ MockRLUSD now shows up in your MetaMask with a balance of 0. Next step will give you tokens.
            </SuccessBox>
          </Step>

          {/* ── Step 5 ── */}
          <Step n={5} title="Mint MockRLUSD tokens">
            <P>The MockRLUSD contract has an open mint function — anyone can call it to get test tokens. The easiest way is via the block explorer:</P>
            <Ol items={[
              'Open the MockRLUSD contract on the block explorer (link below)',
              'Once the page loads, click the "Write contract" tab',
              'Click "Connect wallet" and connect your MetaMask',
              'Find the "mint" function in the list',
              'Enter your wallet address and an amount — e.g. 10000000000 for 10,000 RLUSD (6 decimals)',
              'Click "Write" and confirm the transaction in MetaMask',
            ]} />
            <a
              href={`${EXPLORER_URL}/address/${RLUSD_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cs-btn-primary cs-btn-sm"
              style={{ alignSelf: "flex-start" }}
            >
              Open MockRLUSD on Explorer →
            </a>
            <InfoBox>
              Amount uses 6 decimals: <code style={{ color: "hsl(32 35% 92%)" }}>1000000</code> = 1 RLUSD, <code style={{ color: "hsl(32 35% 92%)" }}>10000000000</code> = 10,000 RLUSD
            </InfoBox>
          </Step>

          {/* ── Step 6 ── */}
          <Step n={6} title="Register on Cascrow">
            <P>Both the Requester and the Builder need a Cascrow account. Registration takes under a minute:</P>
            <Ol items={[
              'Go to cascrow.com/register',
              'Enter your email, choose a password, and select your role (Requester or Builder)',
              'Check your email and click the verification link',
              'Log in — you\'re in',
            ]} />
            <InfoBox>
              For a full test of the flow you need two accounts — one as Requester, one as Builder. Use two different email addresses or two different browsers.
            </InfoBox>
          </Step>

          {/* ── Step 7 ── */}
          <Step n={7} title="Connect your MetaMask wallet">
            <P>After logging in, connect your wallet so Cascrow knows which address to use for signing transactions:</P>
            <Ol items={[
              'Go to your Dashboard',
              'Click "Connect Wallet" — MetaMask will pop up',
              'Select your account and confirm the connection',
              'Your 0x… address now appears on your profile',
            ]} />
          </Step>

          {/* ── Step 8 ── */}
          <Step n={8} title="Create a contract (Requester)">
            <P>As the Requester, you define the milestone and the payout amount:</P>
            <Ol items={[
              'Click "New Contract" on your dashboard',
              'Enter a project title and describe the milestone clearly — this is what the AI will verify against',
              'Set the RLUSD amount and the deadline in days',
              'Optionally enter the Builder\'s wallet address directly, or leave blank to get a shareable invite link',
              'Click "Create Contract"',
            ]} />
            <InfoBox>
              Be specific in the milestone description — the AI reads this to decide if the uploaded proof meets the criteria.
            </InfoBox>
          </Step>

          {/* ── Step 9 ── */}
          <Step n={9} title="Fund the escrow (Requester)">
            <P>Once both parties are linked, you lock the RLUSD on-chain:</P>
            <Ol items={[
              'Open the contract detail page',
              'Click "Fund Escrow" — MetaMask opens with two transactions',
              'First transaction: approve MockRLUSD spending (sign in MetaMask)',
              'Second transaction: fundMilestone() locks the tokens in the escrow contract (sign in MetaMask)',
              'Wait for confirmation — status changes to "Funded"',
            ]} />
            <SuccessBox>
              ✓ The RLUSD is now locked in the smart contract at <code style={{ fontSize: 11, wordBreak: "break-all" }}>{ESCROW_ADDRESS}</code>. Neither party can access it without the AI approving the proof.
            </SuccessBox>
          </Step>

          {/* ── Step 10 ── */}
          <Step n={10} title="Submit proof (Builder)">
            <P>As the Builder, upload evidence that the milestone was completed:</P>
            <Ol items={[
              'Log in with the Builder account and open the contract',
              'Click "Upload Proof"',
              'Upload a PDF document describing what was delivered',
              'Click "Submit" — the AI verification starts automatically',
            ]} />
            <InfoBox>
              The document should clearly address the milestone criteria set by the Requester. Vague or unrelated content will likely get rejected.
            </InfoBox>
          </Step>

          {/* ── Step 11 ── */}
          <Step n={11} title="AI verification & settlement">
            <P>Five AI models independently read the proof and vote. The result is immediate:</P>
            <Ol items={[
              'Watch the contract status — it updates in real time',
              'If 3/5 models vote YES with high confidence → funds are released automatically to the Builder',
              'If confidence is medium (60–85%) → the Requester is notified to review manually',
              'If 3/5 models vote NO → the Builder is notified with a rejection reason and can resubmit',
              'If the deadline passes without a verified proof → the Requester can cancel and get a full refund',
            ]} />
            <SuccessBox>
              ✓ On approval, an NFT completion certificate is minted on the native XRPL Ledger as permanent proof — visible on testnet.xrpl.org.
            </SuccessBox>
          </Step>

          {/* Done */}
          <ScrollReveal>
            <div style={{ textAlign: "center", paddingTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{ fontWeight: 600, fontSize: 28, color: "hsl(32 35% 92%)" }}>
                You&apos;re set.
              </h2>
              <p style={{ fontSize: 15, color: "hsl(30 10% 62%)", maxWidth: 400 }}>
                Questions? Something not working? Open an issue or reach out — we&apos;re happy to help.
              </p>
              <Link href="/register" className="cs-btn-primary">Create your first contract →</Link>
            </div>
          </ScrollReveal>

          {/* ── Agentic Mode ── */}
          <ScrollReveal>
            <div id="agentic" style={{ marginTop: 64, scrollMarginTop: 80 }}>
              {/* Section header */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 40, gap: 12 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.3)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(22 55% 54%)", display: "inline-block" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(22 55% 54%)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Live Now · Agentic Mode</span>
                </div>
                <h2 style={{ fontWeight: 600, fontSize: "clamp(28px, 5vw, 42px)", color: "hsl(32 35% 92%)", margin: 0, lineHeight: 1.1 }}>
                  Let agents do the work
                </h2>
                <p style={{ fontSize: 16, color: "hsl(30 10% 62%)", maxWidth: 520, margin: 0, lineHeight: 1.6 }}>
                  Connect any AI agent to Cascrow via MCP. It submits evidence, the 5-model pipeline verifies, and RLUSD is released on-chain — no human in the loop.
                </p>
              </div>

              {/* 3-column capability cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
                {[
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="2"/><path d="M10 21h7a1 1 0 0 0 .8-1.6l-5.4-6.8A1 1 0 0 1 13 11V3H9v8a1 1 0 0 1-.2.6L3.2 19.4A1 1 0 0 0 4 21h4"/><path d="M10 3h4"/></svg>,
                    title: "API Key auth",
                    body: "Generate a csk_… key in your profile. Any HTTP client or agent framework can authenticate.",
                  },
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>,
                    title: "GitHub connector",
                    body: "Link a repo per milestone. The proof collector fetches commits automatically 48h before deadline.",
                  },
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
                    title: "Stripe connector",
                    body: "Link your Stripe key. Revenue data is encrypted, collected, and included in the proof package.",
                  },
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
                    title: "MCP protocol",
                    body: "Native Claude Code tool. Add the manifest and call cascrow_verify_milestone from any session.",
                  },
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                    title: "On-chain release",
                    body: "Approved evidence triggers releaseMilestone on XRPL EVM — funds move in 3-5 seconds.",
                  },
                  {
                    svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
                    title: "Webhook events",
                    body: "Subscribe to funds.released to trigger downstream logic in your treasury or DAO.",
                  },
                ].map((c) => (
                  <div key={c.title} style={{ padding: "18px 20px", borderRadius: 14, background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.12)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(22 55% 54% / 0.1)", border: "1px solid rgba(196,112,75,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.svg}
                    </div>
                    <p style={{ fontWeight: 600, color: "hsl(32 35% 92%)", fontSize: 14, margin: 0 }}>{c.title}</p>
                    <p style={{ fontSize: 13, color: "hsl(30 10% 62%)", margin: 0, lineHeight: 1.5 }}>{c.body}</p>
                  </div>
                ))}
              </div>

              {/* Steps */}
              <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
                {/* vertical connector line */}
                <div style={{ position: "absolute", left: 13, top: 28, bottom: 28, width: 1, background: "linear-gradient(to bottom, hsl(22 55% 54% / 0.3), rgba(196,112,75,0.05))", zIndex: 0 }} />

                {[
                  {
                    letter: "A",
                    title: "Generate an API Key",
                    body: <>Go to <strong style={{ color: "hsl(28 45% 72%)" }}>Profile → Integrations → API Keys</strong> and click &ldquo;Generate API Key&rdquo;. Copy the <code style={{ color: "hsl(22 55% 54%)", fontSize: 12, background: "hsl(22 55% 54% / 0.1)", padding: "1px 6px", borderRadius: 4 }}>csk_…</code> token — it&apos;s shown only once.</>,
                    extra: null,
                  },
                  {
                    letter: "B",
                    title: "Connect Agent Connectors on a milestone",
                    body: <>When creating a contract, open <strong style={{ color: "hsl(28 45% 72%)" }}>Configure Agent Connectors</strong> inside a milestone block. Paste your GitHub repo URL and/or Stripe secret key. 48h before the deadline the collector runs automatically — startup confirms with one click.</>,
                    extra: null,
                  },
                  {
                    letter: "C",
                    title: "Call the MCP endpoint from your agent",
                    body: <>Any AI agent, CI pipeline, or script can submit evidence and trigger full verification with one call:</>,
                    extra: (
                      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid hsl(22 55% 54% / 0.18)", marginTop: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "hsl(24 14% 4% / 0.5)", borderBottom: "1px solid hsl(22 55% 54% / 0.1)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(196,112,75,0.4)", flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontFamily: "monospace", color: "#6B5E55" }}>POST https://cascrow.com/api/mcp/submit</span>
                        </div>
                        <pre style={{ fontSize: 12, padding: "16px 18px", background: "hsl(24 14% 4% / 0.4)", color: "hsl(32 35% 92%)", overflowX: "auto", margin: 0, lineHeight: 1.7 }}>{`curl -X POST https://cascrow.com/api/mcp/submit \\
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
  }'`}</pre>
                      </div>
                    ),
                  },
                ].map((step) => (
                  <div key={step.letter} style={{ display: "flex", gap: 20, paddingBottom: 32, position: "relative", zIndex: 1 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "hsl(24 14% 6%)", border: "2px solid hsl(22 55% 54% / 0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "hsl(22 55% 54%)" }}>{step.letter}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, color: "hsl(32 35% 92%)", margin: "3px 0 6px", fontSize: 15 }}>{step.title}</p>
                      <p style={{ fontSize: 14, color: "hsl(30 10% 62%)", margin: 0, lineHeight: 1.6 }}>{step.body}</p>
                      {step.extra}
                    </div>
                  </div>
                ))}

                {/* What happens card */}
                <div style={{ display: "flex", gap: 20, position: "relative", zIndex: 1 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(52,211,153,0.1)", border: "2px solid rgba(52,211,153,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, color: "hsl(32 35% 92%)", margin: "3px 0 10px", fontSize: 15 }}>What happens — fully autonomous</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                      {[
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
                          text: "5 AI models vote in parallel (Claude, GPT-4o, Gemini, Mistral, Cerebras)",
                        },
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                          text: "Confidence >85% + majority YES → RLUSD released on XRPL EVM automatically",
                        },
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>,
                          text: "NFT certificate minted on XRP Ledger mainnet",
                        },
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
                          text: "funds.released webhook fires to your downstream systems",
                        },
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
                          text: "Public proof page with QR code + LinkedIn share generated",
                        },
                        {
                          svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
                          text: "Model weights adjusted weekly via feedback loop cron",
                        },
                      ].map((item) => (
                        <div key={item.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
                          <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                            {item.svg}
                          </div>
                          <span style={{ fontSize: 13, color: "hsl(30 10% 62%)", lineHeight: 1.5 }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom CTA bar */}
              <div style={{ marginTop: 32, padding: "16px 20px", borderRadius: 12, background: "hsl(22 55% 54% / 0.06)", border: "1px solid hsl(22 55% 54% / 0.18)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "hsl(32 35% 92%)", margin: "0 0 2px" }}>Claude Code users</p>
                  <p style={{ fontSize: 12, color: "hsl(30 10% 62%)", margin: 0 }}>
                    Add the MCP manifest: <code style={{ color: "hsl(28 45% 72%)", fontSize: 11 }}>https://cascrow.com/mcp-manifest.json</code> · Tool: <code style={{ color: "hsl(28 45% 72%)", fontSize: 11 }}>cascrow_verify_milestone</code>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href="/mcp-manifest.json" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.3)", color: "hsl(22 55% 54%)", textDecoration: "none", fontWeight: 500 }}>MCP manifest ↗</a>
                  <Link href="/register" style={{ fontSize: 13, padding: "8px 16px", borderRadius: 8, background: "hsl(22 55% 54%)", color: "hsl(24 14% 6%)", textDecoration: "none", fontWeight: 600 }}>Get started →</Link>
                </div>
              </div>
            </div>
          </ScrollReveal>

        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
