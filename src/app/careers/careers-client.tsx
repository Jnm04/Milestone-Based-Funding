"use client";

import { useState, useMemo } from "react";

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const card    = "hsl(24 12% 6% / 0.5)";
const dim     = "hsl(28 10% 28%)";

export type RoleType = "Equity" | "Praktikum" | "Festanstellung";

export type Role = {
  title: string;
  type: RoleType;
  duration: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  tags: string[];
};

export const roles: Role[] = [
  {
    title: "Fullstack Developer",
    type: "Equity",
    duration: "Ongoing",
    summary: "Build and polish cascrow's web platform (Next.js) and mobile app (React Native/Expo). You'll work across the full stack — from UI components to API routes to blockchain integrations.",
    tags: ["typescript", "react", "next.js", "react native", "expo", "mobile", "frontend", "backend"],
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
    tags: ["solidity", "hardhat", "evm", "blockchain", "smart contracts", "security", "xrpl"],
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
    title: "Founders Associate",
    type: "Praktikum",
    duration: "3–6 months",
    summary: "Work directly with the founders on everything that matters most right now — strategy, partnerships, investors, and whatever the company needs to move forward. This is the highest-leverage internship we offer.",
    tags: ["strategy", "operations", "biz dev", "investor", "generalist", "startup", "founders"],
    responsibilities: [
      "Join founder meetings, investor calls, and key strategy sessions",
      "Research potential partners, enterprise clients, and market opportunities",
      "Help prepare investor materials, pitch decks, and one-pagers",
      "Identify and execute on the highest-priority operational gaps",
      "Work across every function — product, marketing, sales, operations",
    ],
    requirements: [
      "Studying business, entrepreneurship, computer science, or a related field",
      "Clear, concise communicator — written and verbal, in English",
      "Self-starter who doesn't need tasks handed to them",
      "Genuine interest in AI agents, blockchain, or the future of programmable finance",
      "Bonus: prior experience at a startup or your own entrepreneurial project",
    ],
  },
  {
    title: "UX / UI Designer",
    type: "Praktikum",
    duration: "2–3 months",
    summary: "Shape the visual and interaction language of cascrow. You'll work with an existing dark copper design system and push it further — from landing page to dashboard flows to mobile.",
    tags: ["figma", "design", "ui", "ux", "mobile", "design system"],
    responsibilities: [
      "Create and iterate on Figma designs for new features and existing screens",
      "Improve the onboarding flow, empty states, and mobile responsiveness",
      "Maintain and extend the cascrow design system (colors, typography, components)",
      "Collaborate closely with the developer(s) to hand off production-ready specs",
    ],
    requirements: [
      "Proficient in Figma",
      "Strong eye for dark-mode, minimal UI",
      "Basic understanding of React/Tailwind is a plus but not required",
      "Portfolio showing UI work — especially dashboards or fintech/crypto products",
    ],
  },
  {
    title: "Community Manager",
    type: "Praktikum",
    duration: "2–3 months",
    summary: "Build and nurture the community around cascrow — AI agent developers, crypto builders, and early users. You'll be the first point of contact for people who find us and the voice that makes them stay.",
    tags: ["community", "discord", "telegram", "social media", "web3", "crypto", "ai"],
    responsibilities: [
      "Manage and grow cascrow's presence in AI agent and crypto Discord servers and Telegram groups",
      "Answer questions, gather feedback, and escalate product issues from community channels",
      "Create community content — announcements, weekly updates, AMA sessions",
      "Identify top community contributors and turn them into advocates",
      "Track community metrics and report growth, engagement, and sentiment",
    ],
    requirements: [
      "Active member of at least one AI or crypto community (Discord, Telegram, X/Twitter)",
      "Strong written English — you'll be the voice of cascrow in public channels",
      "Organized: able to manage multiple channels and conversations simultaneously",
      "Genuine interest in AI agents or decentralized finance",
      "Bonus: existing following or network in the AI/crypto space",
    ],
  },
  {
    title: "Marketing & Content",
    type: "Praktikum",
    duration: "2–3 months",
    summary: "Tell the cascrow story to the world — developers, AI agent builders, investors, and enterprises. You'll own content, social, and early growth experiments.",
    tags: ["marketing", "content", "seo", "twitter", "linkedin", "writing", "growth"],
    responsibilities: [
      "Write blog posts, tutorials, and X/Twitter threads about AI agents, escrow, and XRPL",
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
    type: "Praktikum",
    duration: "2–3 months",
    summary: "Find bugs before users do. You'll test cascrow end-to-end — from wallet connection to AI verification to on-chain settlement — and build the automation that keeps it reliable.",
    tags: ["qa", "testing", "playwright", "automation", "bugs", "typescript"],
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
    type: "Praktikum",
    duration: "3 months",
    summary: "Improve the intelligence behind cascrow's 5-model AI verification system. You'll analyze model outputs, identify failure modes, and help tune the system that decides whether funds are released.",
    tags: ["ai", "ml", "python", "data", "llm", "prompt engineering", "research"],
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
    type: "Praktikum",
    duration: "2–3 months",
    summary: "Open the doors to cascrow's first enterprise and partner relationships. You'll research targets, write outreach, and help close the deals that define our early traction.",
    tags: ["business development", "sales", "outreach", "partnerships", "enterprise", "b2b"],
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

const FILTER_LABELS: Record<RoleType | "Alle", string> = {
  Alle: "Alle",
  Equity: "Equity",
  Praktikum: "Praktikum",
  Festanstellung: "Festanstellung",
};

function TypeBadge({ type }: { type: RoleType }) {
  const styles: Record<RoleType, { bg: string; color: string; borderColor: string }> = {
    Equity: {
      bg: "hsl(22 55% 54% / 0.15)",
      color: primary,
      borderColor: "hsl(22 55% 54% / 0.3)",
    },
    Praktikum: {
      bg: "hsl(28 18% 14%)",
      color: muted,
      borderColor: border,
    },
    Festanstellung: {
      bg: "hsl(140 40% 40% / 0.15)",
      color: "hsl(140 50% 65%)",
      borderColor: "hsl(140 40% 40% / 0.3)",
    },
  };
  const s = styles[type];
  return (
    <span
      className="rounded-full px-3 py-0.5 text-xs font-medium"
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.borderColor}`,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
      }}
    >
      {type}
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

const availableFilters: Array<RoleType | "Alle"> = ["Alle", "Equity", "Praktikum", "Festanstellung"];

export function CareersClient() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoleType | "Alle">("Alle");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return roles.filter((role) => {
      const matchesType = activeFilter === "Alle" || role.type === activeFilter;
      if (!matchesType) return false;
      if (!q) return true;
      return (
        role.title.toLowerCase().includes(q) ||
        role.summary.toLowerCase().includes(q) ||
        role.tags.some((t) => t.includes(q))
      );
    });
  }, [search, activeFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { Alle: roles.length };
    for (const role of roles) {
      counts[role.type] = (counts[role.type] ?? 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="flex flex-col gap-8">
      {/* Search + Filter bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke={dim}
            strokeWidth={1.8}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search roles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full pl-9 pr-4 py-2 text-sm outline-none transition-colors"
            style={{
              background: card,
              border: `1px solid ${border}`,
              color: fg,
              fontFamily: "inherit",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(22 55% 54% / 0.4)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = border)}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {availableFilters.map((f) => {
            const count = typeCounts[f] ?? 0;
            if (f !== "Alle" && count === 0) return null;
            const isActive = activeFilter === f;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className="rounded-full px-4 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: isActive ? "hsl(22 55% 54% / 0.15)" : "transparent",
                  color: isActive ? primary : muted,
                  border: `1px solid ${isActive ? "hsl(22 55% 54% / 0.35)" : border}`,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.08em",
                }}
              >
                {FILTER_LABELS[f]}
                <span
                  className="ml-1.5"
                  style={{ color: isActive ? primary : dim, opacity: 0.8 }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <p className="text-sm" style={{ color: muted }}>
            No roles match your search. Try a different keyword or filter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {filtered.map((role) => (
            <RoleCard key={role.title} role={role} />
          ))}
        </div>
      )}

      {/* Result count */}
      {filtered.length > 0 && (
        <p
          className="text-center text-xs"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: dim, letterSpacing: "0.1em" }}
        >
          {filtered.length} of {roles.length} positions
        </p>
      )}
    </div>
  );
}
