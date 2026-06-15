"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const card    = "hsl(24 12% 6% / 0.5)";
const dim     = "hsl(28 10% 28%)";

export type RoleType = "Equity" | "Internship" | "Full-time";

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
    summary: "Build and ship features across cascrow's web platform (Next.js) and mobile app (React Native). You'll touch everything from UI to API routes to blockchain integrations.",
    tags: ["typescript", "react", "next.js", "react native", "expo", "mobile", "frontend", "backend", "python"],
    responsibilities: [
      "Develop and improve frontend features in Next.js (App Router) and TypeScript",
      "Build out the React Native / Expo mobile app from its current scaffold",
      "Work with our dual-chain backend (XRPL + EVM) and AI verification services",
      "Improve UI consistency and fix rough edges across the platform",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Strong TypeScript and React skills",
      "Experience with Next.js, App Router preferred",
      "Solid Git workflow and comfortable with the standard developer toolchain",
      "Actively uses AI tools (Claude, GitHub Copilot, or similar) in daily work",
      "Bonus: React Native or Expo experience",
      "Bonus: Python for scripting and data work",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Smart Contract Developer",
    type: "Equity",
    duration: "Ongoing",
    summary: "Own and evolve the MilestoneFundEscrow contract on the XRPL EVM Sidechain. Real funds go through this code, so security and reliability come first.",
    tags: ["solidity", "hardhat", "evm", "blockchain", "smart contracts", "security", "xrpl", "python"],
    responsibilities: [
      "Maintain and extend our Solidity escrow contract (Hardhat)",
      "Write tests and run internal security reviews",
      "Design and implement new contract features like multi-party and conditional release",
      "Keep up with XRPL EVM updates and coordinate with the community",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Solid Solidity experience and EVM fundamentals",
      "Familiarity with Hardhat and testing frameworks (Mocha/Chai or Foundry)",
      "Security mindset with experience in reentrancy, integer overflow, and access control",
      "Uses AI tools (Claude, Copilot) actively in development",
      "Bonus: Python for scripting and test automation",
      "Bonus: experience with XRPL or non-Ethereum EVMs",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Founders Associate",
    type: "Internship",
    duration: "3-6 months",
    summary: "Work directly with the founders on strategy, partnerships, and investor relations. You will be in the room for the decisions that shape the company. This is the most generalist role we offer and the one with the most exposure.",
    tags: ["strategy", "operations", "biz dev", "investor", "generalist", "startup", "founders"],
    responsibilities: [
      "Join founder meetings, investor calls, and key strategy sessions",
      "Research potential partners, enterprise clients, and market opportunities",
      "Help prepare investor materials, pitch decks, and one-pagers",
      "Spot and fix operational gaps before they become real problems",
      "Jump in wherever the company needs you most",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Studying business, entrepreneurship, computer science, or something related",
      "Self-starter who figures things out without being told what to do",
      "Proficient in MS Office (Word, Excel, PowerPoint)",
      "Comfortable using AI tools like Claude or Copilot to work faster",
      "Genuine interest in AI agents, blockchain, or programmable finance",
      "Bonus: you have tried to build something yourself before",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "UX / UI Designer",
    type: "Internship",
    duration: "2-3 months",
    summary: "Shape how cascrow looks and feels. You will work with an existing dark copper design system and push it further across landing pages, dashboard flows, and mobile screens.",
    tags: ["figma", "design", "ui", "ux", "mobile", "design system"],
    responsibilities: [
      "Create and iterate on Figma designs for new and existing screens",
      "Improve the onboarding flow, empty states, and mobile responsiveness",
      "Maintain and extend the cascrow design system",
      "Work closely with developers to hand off specs that are actually usable",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Proficient in Figma",
      "Strong eye for dark-mode and minimal UI",
      "Comfortable using AI tools for design research, copy, and ideation",
      "Proficient in MS Office",
      "Portfolio with UI work, ideally dashboards or fintech/crypto products",
      "Bonus: basic understanding of React or Tailwind",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Community Manager",
    type: "Internship",
    duration: "2-3 months",
    summary: "Build the community around cascrow from the ground up. AI agent developers, crypto builders, early users. You will be the first person they talk to and the reason they stick around.",
    tags: ["community", "discord", "telegram", "social media", "web3", "crypto", "ai"],
    responsibilities: [
      "Grow cascrow's presence in AI agent and crypto Discord servers and Telegram groups",
      "Answer questions, collect feedback, and flag product issues from community channels",
      "Write announcements, weekly updates, and run AMA sessions",
      "Find the most active community members and turn them into advocates",
      "Track growth, engagement, and sentiment and report back weekly",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Already active in at least one AI or crypto community on Discord, Telegram, or X",
      "Organized enough to manage multiple channels at once",
      "Comfortable using AI tools (Claude, ChatGPT) for drafting and research",
      "Proficient in MS Office for reporting and slides",
      "Genuine interest in AI agents or decentralized finance",
      "Bonus: you already have a following or network in the space",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Marketing and Content",
    type: "Internship",
    duration: "2-3 months",
    summary: "Tell the cascrow story. Write for developers, AI builders, investors, and enterprises. Own content, social, and early growth experiments.",
    tags: ["marketing", "content", "seo", "twitter", "linkedin", "writing", "growth"],
    responsibilities: [
      "Write blog posts, tutorials, and X/Twitter threads about AI agents, escrow, and XRPL",
      "Manage and grow cascrow's LinkedIn and X presence",
      "Plan and coordinate a Product Hunt launch",
      "Build out an SEO strategy and improve existing pages",
      "Track what is working and report on it",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "You understand what we are building and care about it",
      "Comfortable using AI tools (Claude, Copilot, ChatGPT) for research, drafts, and ideation",
      "Proficient in MS Office",
      "Some experience with social media or content marketing",
      "Comfortable looking at analytics and drawing conclusions from them",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "QA / Testing Engineer",
    type: "Internship",
    duration: "2-3 months",
    summary: "Find bugs before users do. Test cascrow end to end, from wallet connection to AI verification to on-chain settlement, and build the automation that keeps it working.",
    tags: ["qa", "testing", "playwright", "automation", "bugs", "typescript"],
    responsibilities: [
      "Manually test all user flows: contract creation, escrow funding, proof submission, AI verification, and release",
      "Write end-to-end tests with Playwright",
      "Document bugs with clear reproduction steps and screenshots",
      "Build a regression test suite so new features do not break old ones",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "You enjoy breaking things on purpose",
      "Basic JavaScript or TypeScript to write Playwright tests",
      "Comfortable with web apps and browser dev tools",
      "Proficient in MS Office for bug documentation and reports",
      "Familiar with AI tools and how to use them to speed up testing workflows",
      "Bonus: experience testing crypto or fintech products",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Data / AI Research",
    type: "Internship",
    duration: "3 months",
    summary: "Improve cascrow's 5-model AI verification system. Dig into model outputs, find where it fails, and help tune the system that decides whether funds get released.",
    tags: ["ai", "ml", "python", "data", "llm", "prompt engineering", "research"],
    responsibilities: [
      "Analyze historical AI verification decisions: labels, confidence scores, disagreements",
      "Find categories of proofs where the system performs poorly",
      "Test prompt variants and measure their impact across all 5 models",
      "Build simple dashboards to track model performance over time",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Python proficiency: data analysis, pandas, visualization",
      "Hands-on experience with AI tools (Claude, ChatGPT, Copilot) in research or development",
      "Familiarity with LLMs and prompt engineering",
      "Studying computer science, data science, or something related",
      "Bonus: experience with model evaluation or benchmarking",
      "Bonus: German is a plus",
    ],
  },
  {
    title: "Business Development",
    type: "Internship",
    duration: "2-3 months",
    summary: "Get cascrow in front of the right people. Research targets, write outreach, and help close the early deals that define our traction.",
    tags: ["business development", "sales", "outreach", "partnerships", "enterprise", "b2b"],
    responsibilities: [
      "Research and identify potential enterprise clients: DAOs, AI agent platforms, accelerators",
      "Write and run outbound email sequences to AI agent developers and investors",
      "Map the AI agent ecosystem: AutoGPT, CrewAI, Eliza, AgentKit, and others",
      "Support partnership negotiations and prepare materials for calls",
    ],
    requirements: [
      "Fluent in English, written and spoken",
      "Proficient in MS Office (Word, Excel, PowerPoint)",
      "Comfortable using AI tools (Claude, Copilot) for research and drafting outreach",
      "Interest in AI agents, blockchain, or B2B SaaS",
      "Organized and persistent. Outreach is a numbers game.",
      "Bonus: existing network in crypto or AI startup communities",
      "Bonus: German is a plus",
    ],
  },
];

const FILTER_LABELS: Record<RoleType | "All", string> = {
  All: "All",
  Equity: "Equity",
  Internship: "Internship",
  "Full-time": "Full-time",
};

function TypeBadge({ type }: { type: RoleType }) {
  const styles: Record<RoleType, { bg: string; color: string; borderColor: string }> = {
    Equity: {
      bg: "hsl(22 55% 54% / 0.15)",
      color: primary,
      borderColor: "hsl(22 55% 54% / 0.3)",
    },
    Internship: {
      bg: "hsl(28 18% 14%)",
      color: muted,
      borderColor: border,
    },
    "Full-time": {
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
        <Link
          href={`/careers/apply?role=${encodeURIComponent(role.title)}`}
          className="rounded-full px-5 py-2 text-sm font-medium shrink-0 transition-opacity hover:opacity-80"
          style={{
            background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)",
            color: "hsl(24 14% 6%)",
          }}
        >
          Apply
        </Link>
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

const availableFilters: Array<RoleType | "All"> = ["All", "Equity", "Internship", "Full-time"];

export function CareersClient() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoleType | "All">("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return roles.filter((role) => {
      const matchesType = activeFilter === "All" || role.type === activeFilter;
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
    const counts: Record<string, number> = { All: roles.length };
    for (const role of roles) {
      counts[role.type] = (counts[role.type] ?? 0) + 1;
    }
    return counts;
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            placeholder="Search roles..."
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

        <div className="flex items-center gap-2 flex-wrap">
          {availableFilters.map((f) => {
            const count = typeCounts[f] ?? 0;
            if (f !== "All" && count === 0) return null;
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
