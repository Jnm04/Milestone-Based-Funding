import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { CareersClient } from "./careers-client";

export const metadata: Metadata = {
  title: "Careers | Cascrow",
  description:
    "Join the team building the escrow layer for the agent economy. Equity, internship, and Pflichtpraktikum positions available.",
};

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const card    = "hsl(24 12% 6% / 0.5)";

export default function CareersPage() {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(24 14% 4%)", color: fg }}>
      <SiteNav />

      <main className="container-tight pt-36 pb-24 max-w-3xl">
        {/* Hero */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="h-px w-8"
              style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: primary,
              }}
            >
              Careers
            </span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-4" style={{ color: fg }}>
            Build the escrow layer<br />for the agent economy.
          </h1>
          <p className="text-lg max-w-xl leading-relaxed" style={{ color: muted }}>
            cascrow is an early-stage startup at the intersection of AI agents, blockchain, and
            programmable finance. We&apos;re a small team moving fast — every person here has real
            impact.
          </p>
        </div>

        {/* What we offer */}
        <div
          className="rounded-2xl p-7 mb-14 grid gap-6 sm:grid-cols-3"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          {[
            {
              label: "Real ownership",
              desc: "Equity roles get a meaningful stake. You build it, you own part of it.",
            },
            {
              label: "Steep learning curve",
              desc: "XRPL, EVM, multi-model AI, Next.js — you&apos;ll work across the entire stack.",
            },
            {
              label: "Remote & async",
              desc: "Work from wherever. We care about output, not hours.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="text-sm font-medium" style={{ color: fg }}>
                {label}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: muted }}>
                {desc}
              </p>
            </div>
          ))}
        </div>

        {/* Open positions with search + filter */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-8">
            <span
              className="h-px w-6"
              style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.22em",
                color: primary,
              }}
            >
              Open positions
            </span>
          </div>
          <CareersClient />
        </div>

        {/* CTA */}
        <div
          className="rounded-2xl p-8"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <h2 className="text-lg font-semibold mb-2" style={{ color: fg }}>
            Don&apos;t see the right role?
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: muted }}>
            We&apos;re always open to hearing from people who are excited about what we&apos;re
            building. Send us a short intro and tell us where you&apos;d fit in.
          </p>
          <a
            href="mailto:jobs@cascrow.com"
            className="inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
              color: "hsl(24 14% 6%)",
            }}
          >
            jobs@cascrow.com
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
