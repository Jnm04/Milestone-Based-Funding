"use client";

import React from "react";
import Link from "next/link";
import { NodeBackground } from "@/components/node-background";
import { ScrollReveal } from "@/components/scroll-reveal";
import { FOOTER_LOGOS, type FooterLogoItem } from "@/components/brand-icons";

function FooterLogo({ logo }: { logo: FooterLogoItem }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      title={logo.name}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, cursor: "default", transition: "filter 0.2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {logo.renderIcon(hovered)}
    </div>
  );
}

const RLUSD_ADDRESS = "0xF717cC3a7ae4a8839e7d964B64A622Dae523a348";
const ESCROW_ADDRESS = "0x7d0B1119c3b2b6e9aAc025ae6A051C67eF40d8c4";
const CHAIN_ID = "1449000";
const RPC_URL = "https://rpc.testnet.xrplevm.org";
const EXPLORER_URL = "https://explorer.testnet.xrplevm.org";
const FAUCET_URL = "https://faucet.xrplevm.org";

function NavLogoMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B" }} />
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
      </div>
      <span style={{ fontFamily: "var(--font-libre-franklin), sans-serif", fontWeight: 300, fontSize: 16, color: "#EDE6DD", letterSpacing: "4px" }}>
        cascrow
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text)}
      style={{
        fontSize: "11px",
        padding: "3px 10px",
        borderRadius: "6px",
        background: "rgba(196,112,75,0.1)",
        border: "1px solid rgba(196,112,75,0.25)",
        color: "#C4704B",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(196,112,75,0.2)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "rgba(196,112,75,0.1)")}
    >
      Copy
    </button>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.25)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
        <span style={{ fontSize: "10px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
        <code style={{ fontSize: "13px", color: "#EDE6DD", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</code>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
      background: "rgba(196,112,75,0.12)", border: "1px solid rgba(196,112,75,0.3)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "14px", fontWeight: 700, color: "#C4704B",
    }}>{n}</div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <ScrollReveal delay={(n - 1) * 60}>
      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <StepBadge n={n} />
          <div style={{ width: 1, flex: 1, background: "rgba(196,112,75,0.15)", marginTop: 8 }} />
        </div>
        <div style={{ flex: 1, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, fontSize: 20, color: "#EDE6DD", marginTop: 6 }}>{title}</h3>
          {children}
        </div>
      </div>
    </ScrollReveal>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(196,112,75,0.06)", border: "1px solid rgba(196,112,75,0.18)", fontSize: "13px", color: "#A89B8C", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", fontSize: "13px", color: "#A89B8C", lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: "14px", color: "#A89B8C", lineHeight: 1.75 }}>{children}</p>;
}

function Ol({ items }: { items: string[] }) {
  return (
    <ol style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 20 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: "14px", color: "#A89B8C", lineHeight: 1.7, listStyleType: "decimal" }}>{item}</li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#171311", color: "#EDE6DD" }}>
      <NodeBackground />

      {/* Nav */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{ background: "rgba(23,19,17,0.92)", backdropFilter: "blur(20px)", borderBottomColor: "rgba(196,112,75,0.12)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/"><NavLogoMark /></Link>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#A89B8C" }}>
            <Link href="/#problem" className="transition-colors hover:text-[#EDE6DD]">Why us</Link>
            <Link href="/#how" className="transition-colors hover:text-[#EDE6DD]">How it works</Link>
            <Link href="/#features" className="transition-colors hover:text-[#EDE6DD]">Features</Link>
            <Link href="/guide" style={{ color: "#C4704B" }}>Guide</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm transition-colors" style={{ color: "#A89B8C" }}>Login</Link>
            <Link href="/register" className="cs-btn-primary cs-btn-sm">Register</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center" style={{ position: "relative", zIndex: 1 }}>
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#C4704B" }}>Testnet Guide</p>
          <h1
            className="tracking-tight"
            style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, fontSize: "clamp(36px, 6vw, 58px)", color: "#EDE6DD" }}
          >
            Get started on testnet
          </h1>
          <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color: "#A89B8C" }}>
            Everything you need to set up MetaMask, get test tokens, and run your first escrow — step by step.
          </p>
        </ScrollReveal>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}>
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
              Amount uses 6 decimals: <code style={{ color: "#EDE6DD" }}>1000000</code> = 1 RLUSD, <code style={{ color: "#EDE6DD" }}>10000000000</code> = 10,000 RLUSD
            </InfoBox>
          </Step>

          {/* ── Step 6 ── */}
          <Step n={6} title="Register on Cascrow">
            <P>Both the investor and the startup need a Cascrow account. Registration takes under a minute:</P>
            <Ol items={[
              'Go to cascrow.com/register',
              'Enter your email, choose a password, and select your role (Grant Giver or Receiver)',
              'Check your email and click the verification link',
              'Log in — you\'re in',
            ]} />
            <InfoBox>
              For a full test of the flow you need two accounts — one as Grant Giver (investor), one as Receiver (startup). Use two different email addresses or two different browsers.
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
          <Step n={8} title="Create a contract (Grant Giver)">
            <P>As the Grant Giver, you define the milestone and the payout amount:</P>
            <Ol items={[
              'Click "New Contract" on your dashboard',
              'Enter a project title and describe the milestone clearly — this is what the AI will verify against',
              'Set the RLUSD amount and the deadline in days',
              'Optionally enter the Receiver\'s wallet address directly, or leave blank to get a shareable invite link',
              'Click "Create Contract"',
            ]} />
            <InfoBox>
              Be specific in the milestone description — the AI reads this to decide if the uploaded proof meets the criteria.
            </InfoBox>
          </Step>

          {/* ── Step 9 ── */}
          <Step n={9} title="Fund the escrow (Grant Giver)">
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
          <Step n={10} title="Submit proof (Receiver)">
            <P>As the Receiver (startup), upload evidence that the milestone was completed:</P>
            <Ol items={[
              'Log in with the Receiver account and open the contract',
              'Click "Upload Proof"',
              'Upload a PDF document describing what was delivered',
              'Click "Submit" — the AI verification starts automatically',
            ]} />
            <InfoBox>
              The document should clearly address the milestone criteria set by the investor. Vague or unrelated content will likely get rejected.
            </InfoBox>
          </Step>

          {/* ── Step 11 ── */}
          <Step n={11} title="AI verification & settlement">
            <P>Five AI models independently read the proof and vote. The result is immediate:</P>
            <Ol items={[
              'Watch the contract status — it updates in real time',
              'If 3/5 models vote YES with high confidence → funds are released automatically to the Receiver',
              'If confidence is medium (60–85%) → the investor is notified to review manually',
              'If 3/5 models vote NO → the Receiver is notified with a rejection reason and can resubmit',
              'If the deadline passes without a verified proof → the investor can cancel and get a full refund',
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
              <h2 style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, fontSize: 28, color: "#EDE6DD" }}>
                You&apos;re set.
              </h2>
              <p style={{ fontSize: 15, color: "#A89B8C", maxWidth: 400 }}>
                Questions? Something not working? Open an issue or reach out — we&apos;re happy to help.
              </p>
              <Link href="/register" className="cs-btn-primary">Create your first contract →</Link>
            </div>
          </ScrollReveal>

        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 border-t" style={{ borderColor: "rgba(196,112,75,0.12)", position: "relative", zIndex: 1 }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between py-6 text-sm" style={{ color: "#A89B8C" }}>
          {/* Left — logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B" }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
            </div>
            <span style={{ fontFamily: "var(--font-libre-franklin), sans-serif", fontWeight: 300, fontSize: 16, color: "#EDE6DD", letterSpacing: "4px" }}>
              cascrow
            </span>
          </div>

          {/* Center — powered by */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "#3D342C", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Powered by
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {FOOTER_LOGOS.map((logo) => (
                <FooterLogo key={logo.name} logo={logo} />
              ))}
            </div>
          </div>

          {/* Right — copyright + nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontSize: 11, color: "#3D342C" }}>© 2026 Cascrow</span>
            <div className="flex gap-6">
              <Link href="/login" className="transition-colors hover:text-[#EDE6DD]">Sign in</Link>
              <Link href="/register" className="transition-colors hover:text-[#EDE6DD]">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
