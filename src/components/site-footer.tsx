"use client";

import React from "react";
import Link from "next/link";

const muted  = "hsl(30 10% 62%)";
const fg     = "hsl(32 35% 92%)";
const border = "hsl(28 18% 14%)";
const dim    = "hsl(28 10% 28%)";

export function SiteFooter() {
  return (
    <footer className="border-t" style={{ background: "hsl(24 14% 4%)", borderColor: border }}>
      <div className="container-tight py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand col */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
              <span className="text-sm font-semibold tracking-tight" style={{ color: fg }}>cascrow</span>
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: muted }}>
              AI-powered escrow on the XRP Ledger. Lock RLUSD, verify milestones with 5-model consensus, release funds instantly.
            </p>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "hsl(22 55% 54%)" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: muted }}>Live on XRPL EVM</span>
            </div>
          </div>

          {/* Product */}
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: dim }}>Product</p>
            {[
              { href: "/guide",    label: "Guide" },
              { href: "/security", label: "Security" },
              { href: "/stats",    label: "Stats" },
              { href: "/login",    label: "Sign in" },
              { href: "/register", label: "Register" },
            ].map(l => (
              <Link key={l.href} href={l.href} className="text-sm transition-colors hover:text-foreground" style={{ color: muted }}>{l.label}</Link>
            ))}
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: dim }}>Legal</p>
            {[
              { href: "/impressum",   label: "Legal Notice" },
              { href: "/terms",       label: "Terms of Use" },
              { href: "/datenschutz", label: "Privacy Policy" },
              { href: "/risiken",     label: "Risk Disclosure" },
              { href: "/widerruf",    label: "Withdrawal" },
              { href: "/avv",         label: "DPA" },
            ].map(l => (
              <Link key={l.href} href={l.href} className="text-sm transition-colors hover:text-foreground" style={{ color: muted }}>{l.label}</Link>
            ))}
          </div>

          {/* Stack */}
          <div className="flex flex-col gap-4">
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase" as const, color: dim }}>Built with</p>
            {["XRPL EVM Sidechain", "RLUSD (Ripple)", "Anthropic Claude", "Google Gemini", "OpenAI GPT", "Vercel"].map(s => (
              <span key={s} className="text-sm" style={{ color: muted }}>{s}</span>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center" style={{ borderColor: border }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: dim }}>© 2026 Cascrow</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: dim }}>hello@cascrow.com</span>
        </div>
      </div>
    </footer>
  );
}
