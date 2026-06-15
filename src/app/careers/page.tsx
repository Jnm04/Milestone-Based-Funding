import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Careers | Cascrow",
  description: "Join the team building the escrow layer for the agent economy. Equity and internship positions available.",
};

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const card    = "hsl(24 12% 6% / 0.5)";
const dim     = "hsl(28 10% 28%)";

type Role = {
  title: string;
  type: "Equity" | "Pflichtpraktikum";
  duration: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
};

const roles: Role[] = [
  {
    title: "Fullstack Developer",
    type: "Equity",
    duration: "Ongoing",
    summary: "Build and polish cascrow's web platform (Next.js) and mobile app (React Native/Expo). You'll work across the full stack — from UI components to API routes to blockchain integrations.",
    responsibilities: [
      "Develop and improve frontend features in Next.js (App Router) and TypeScript",
      "Build out the React Native / Expo mobile app from its current scaffold",
      "Work with our dual-chain backend (XRPL + EVM) and AI verification services",
      "Improve UI/UX consistency across the platform",
    ],
    requirements: [
      "Strong TypeScript and React skills",
      "Experience with Next.js (App Router preferred)",
      "React Native / Expo experience is a plus",
      "Comfortable working in an early-stage, fast-moving environment",
    ],
  },
  {
    title: "Smart Contract Developer",
    type: "Equity",
    duration: "Ongoing",
    summary: "Own and evolve the MilestoneFundEscrow smart contract on the XRPL EVM Sidechain. This is a high-trust, high-impact role — you're writing the code that holds real funds.",
    responsibilities: [
      "Maintain and extend our Solidity escrow contract (Hardhat)",
      "Write comprehensive tests and conduct internal security reviews",
      "Design and implement new contract features (multi-party, conditional release)",
      "Coordinate with the XRPL EVM community and stay current on chain updates",
    ],
    requirements: [
      "Solid Solidity experience and EVM fundamentals",
      "Familiarity with Hardhat and testing frameworks (Mocha/Chai or Foundry)",
      "Security-first mindset — experience with reentrancy, integer overflow, access control",
      "Bonus: experience with XRPL or non-Ethereum EVMs",
    ],
  },
  {
    title: "UX / UI Designer",
    type: "Pflichtpraktikum",
    duration: "2–3 months",
    summary: "Shape the visual and interaction language of cascrow. You'll work with an existing dark copper design system and push it further — from landing page to dashboard flows to mobile.",
    responsibilities: [
      "Create and iterate on Figma designs for new features and existing screens",
      "Improve the onboarding flow, empty states, and mobile responsiveness",
      "Maintain and extend the cascrow design system (colors, typography, components)",
      "Collaborate closely with the developer(s) to hand off production-ready specs",
    ],
    requirements: [
      "Proficient in Figma",
      "Strong eye for dark-mode, minimal UI (no need for flashy gradients)",
      "Basic understanding of React/Tailwind is a plus but not required",
      "Portfolio showing UI work — especially dashboards or fintech/crypto products",
    ],
  },
  {
    title: "Marketing & Content",
    type: "Pflichtpraktikum",
    duration: "2–3 months",
    summary: "Tell the cascrow story to the world — developers, AI agent builders, investors, and enterprises. You'll own content, social, and early growth experiments.",
    responsibilities: [
      "Write blog posts, tutorials, and Twitter/X threads about AI agents, escrow, and XRPL",
      "Manage and grow cascrow's LinkedIn and X/Twitter presence",
      "Coordinate a Product Hunt launch",
      "Develop SEO strategy and optimize existing pages",
      "Track and report on content performance",
    ],
    requirements: [
      "Strong written English (German is a bonus)",
      "Interest in AI, crypto, or fintech — you should understand what we're building",
      "Experience with social media management or content marketing",
      "Analytical: comfortable reading basic analytics data",
    ],
  },
  {
    title: "QA / Testing Engineer",
    type: "Pflichtpraktikum",
    duration: "2–3 months",
    summary: "Find bugs before users do. You'll test cascrow end-to-end — from wallet connection to AI verification to on-chain settlement — and build the automation that keeps it reliable.",
    responsibilities: [
      "Manually test all user flows (contract creation, escrow funding, proof submission, AI verification, release)",
      "Write end-to-end tests with Playwright",
      "Document bugs clearly with reproduction steps and screenshots",
      "Build a regression test suite so new features don't break existing ones",
    ],
    requirements: [
      "Methodical mindset — you enjoy breaking things intentionally",
      "Basic JavaScript/TypeScript to write Playwright tests",
      "Familiarity with web apps and browser dev tools",
      "Bonus: experience testing crypto or fintech products",
    ],
  },
  {
    title: "Data / AI Research",
    type: "Pflichtpraktikum",
    duration: "3 months",
    summary: "Improve the intelligence behind cascrow's 5-model AI verification system. You'll analyze model outputs, identify failure modes, and help tune the system that decides whether funds are released.",
    responsibilities: [
      "Analyze historical AI verification decisions (labels, confidence scores, disagreements)",
      "Identify categories of proofs where the system performs poorly",
      "Experiment with prompt variants and evaluate impact across all 5 models",
      "Build simple dashboards to track model performance over time",
    ],
    requirements: [
      "Python proficiency — data analysis, pandas, visualization",
      "Familiarity with LLMs and prompt engineering",
      "Studying computer science, data science, or a related field",
      "Bonus: experience with model evaluation or ML benchmarking",
    ],
  },
  {
    title: "Business Development",
    type: "Pflichtpraktikum",
    duration: "2–3 months",
    summary: "Open the doors to cascrow's first enterprise and partner relationships. You'll research targets, write outreach, and help close the deals that define our early traction.",
    responsibilities: [
      "Research and identify potential enterprise clients (DAOs, AI agent platforms, accelerators)",
      "Write and run outbound email sequences targeting AI agent developers and investors",
      "Map the AI agent ecosystem — AutoGPT, CrewAI, Eliza, AgentKit, and beyond",
      "Support partnership negotiations and prepare materials for calls",
    ],
    requirements: [
      "Excellent written communication in English",
      "Interest in AI agents, blockchain, or B2B SaaS",
      "Organized and persistent — outreach is a numbers game",
      "Bonus: existing network in crypto or AI startup communities",
    ],
  },
];

function TypeBadge({ type }: { type: Role["type"] }) {
  const isEquity = type === "Equity";
  return (
    <span
      className="rounded-full px-3 py-0.5 text-xs font-medium"
      style={{
        background: isEquity ? "hsl(22 55% 54% / 0.15)" : "hsl(28 18% 14%)",
        color: isEquity ? primary : muted,
        border: `1px solid ${isEquity ? "hsl(22 55% 54% / 0.3)" : border}`,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
      }}
    >
      {isEquity ? "Equity" : "Pflichtpraktikum"}
    </span>
  );
}

function RoleCard({ role }: { role: Role }) {
  return (
    <div
      className="rounded-2xl p-7 flex flex-col gap-5"
      style={{ background: card, border: `1px solid ${border}` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight" style={{ color: fg }}>
            {role.title}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={role.type} />
            <span
              className="text-xs"
              style={{ fontFamily: "'JetBrains Mono', monospace", color: dim, letterSpacing: "0.1em" }}
            >
              {role.duration} · Remote
            </span>
          </div>
        </div>
        <a
          href={`mailto:jobs@cascrow.com?subject=Application: ${encodeURIComponent(role.title)}`}
          className="rounded-full px-5 py-2 text-sm font-medium shrink-0 transition-opacity hover:opacity-80"
          style={{
            background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
            color: "hsl(24 14% 6%)",
          }}
        >
          Apply
        </a>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: muted }}>
        {role.summary}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: dim,
            }}
          >
            What you&apos;ll do
          </p>
          <ul className="flex flex-col gap-2">
            {role.responsibilities.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm" style={{ color: muted }}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: primary }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2.5">
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: dim,
            }}
          >
            What we&apos;re looking for
          </p>
          <ul className="flex flex-col gap-2">
            {role.requirements.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm" style={{ color: muted }}>
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: dim }} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CareersPage() {
  const equityRoles = roles.filter((r) => r.type === "Equity");
  const internRoles = roles.filter((r) => r.type === "Pflichtpraktikum");

  return (
    <div style={{ minHeight: "100vh", background: "hsl(24 14% 4%)", color: fg }}>
      <SiteNav />

      <main className="container-tight pt-36 pb-24 max-w-3xl">
        {/* Hero */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }} />
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
            cascrow is an early-stage startup at the intersection of AI agents, blockchain, and programmable finance.
            We&apos;re a small team moving fast — every person here has real impact.
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
              desc: "XRPL, EVM, multi-model AI, Next.js — you'll work across the entire stack.",
            },
            {
              label: "Remote & async",
              desc: "Work from wherever. We care about output, not hours.",
            },
          ].map(({ label, desc }) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="text-sm font-medium" style={{ color: fg }}>{label}</p>
              <p className="text-sm leading-relaxed" style={{ color: muted }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Equity roles */}
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-6" style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: primary,
            }}
          >
            Equity positions
          </span>
        </div>
        <div className="flex flex-col gap-5 mb-14">
          {equityRoles.map((role) => (
            <RoleCard key={role.title} role={role} />
          ))}
        </div>

        {/* Internship roles */}
        <div className="mb-4 flex items-center gap-3">
          <span className="h-px w-6" style={{ background: `linear-gradient(90deg, ${dim}, transparent)` }} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: dim,
            }}
          >
            Pflichtpraktikum
          </span>
        </div>
        <p className="text-sm mb-8 leading-relaxed max-w-xl" style={{ color: muted }}>
          These positions are designed for students completing a mandatory internship (Pflichtpraktikum) as part of their degree.
          Please include your university enrollment confirmation when applying.
        </p>
        <div className="flex flex-col gap-5 mb-14">
          {internRoles.map((role) => (
            <RoleCard key={role.title} role={role} />
          ))}
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
            We&apos;re always open to hearing from people who are excited about what we&apos;re building.
            Send us a short intro and tell us where you&apos;d fit in.
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
