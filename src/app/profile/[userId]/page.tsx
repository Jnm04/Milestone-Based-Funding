export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { REPUTATION_CATEGORIES, type ReputationCategory } from "@/services/ai/reputation.service";

interface ProfilePageProps {
  params: Promise<{ userId: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, companyName: true },
  });
  const name = user?.name ?? user?.companyName ?? "Startup";
  return {
    title: `${name} — Reputation | cascrow`,
    description: `On-chain milestone track record for ${name} on cascrow.`,
  };
}

const CATEGORY_LABELS: Record<ReputationCategory, string> = {
  MVP:         "MVP / Product",
  REVENUE:     "Revenue",
  PARTNERSHIP: "Partnership",
  GITHUB:      "GitHub / Code",
  BETA:        "Beta / Pilot",
  OTHER:       "Other",
};

const CATEGORY_COLORS: Record<ReputationCategory, { bg: string; text: string; border: string }> = {
  MVP:         { bg: "hsl(22 55% 54% / 0.12)",  text: "#E8935A",  border: "hsl(22 55% 54% / 0.3)"  },
  REVENUE:     { bg: "rgba(74,222,128,0.1)",   text: "#6EE09A",  border: "rgba(74,222,128,0.25)" },
  PARTNERSHIP: { bg: "rgba(167,139,250,0.12)", text: "#C4ADFA",  border: "rgba(167,139,250,0.3)" },
  GITHUB:      { bg: "rgba(96,165,250,0.12)",  text: "#7DB8F7",  border: "rgba(96,165,250,0.3)"  },
  BETA:        { bg: "rgba(212,160,60,0.12)",  text: "#D4A03C",  border: "rgba(212,160,60,0.3)"  },
  OTHER:       { bg: "rgba(168,155,140,0.1)",  text: "hsl(30 10% 62%)",  border: "rgba(168,155,140,0.2)" },
};

export default async function StartupProfilePage({ params }: ProfilePageProps) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, companyName: true, bio: true, website: true, role: true },
  });

  if (!user || user.role !== "STARTUP") return notFound();

  const [score, publicMilestones] = await Promise.all([
    prisma.reputationScore.findUnique({ where: { userId } }),
    prisma.milestone.findMany({
      where: {
        status: "COMPLETED",
        reputationPublic: true,
        reputationSummary: { not: null },
        contract: { startupId: userId },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        reputationSummary: true,
        reputationCategory: true,
        amountUSD: true,
        updatedAt: true,
      },
    }),
  ]);

  const displayName = user.name ?? user.companyName ?? "Unnamed Startup";
  const total = score?.totalCompleted ?? 0;
  const onTimeRate = score?.onTimeRate ?? null;
  const avgConf = score?.avgAiConfidence ?? null;
  const avgResub = score?.avgResubmissions ?? null;
  const categories = (score?.categories ?? {}) as Record<ReputationCategory, number>;

  // Score tier
  let tier: "new" | "rising" | "established" | "trusted" = "new";
  if (total >= 10) tier = "trusted";
  else if (total >= 5) tier = "established";
  else if (total >= 1) tier = "rising";

  const TIER_CONFIG = {
    new:         { label: "New",         bg: "rgba(168,155,140,0.1)",  text: "hsl(30 10% 62%)",  border: "rgba(168,155,140,0.25)" },
    rising:      { label: "Rising",      bg: "hsl(22 55% 54% / 0.12)",  text: "#E8935A",  border: "hsl(22 55% 54% / 0.35)"  },
    established: { label: "Established", bg: "rgba(167,139,250,0.12)", text: "#C4ADFA",  border: "rgba(167,139,250,0.35)" },
    trusted:     { label: "Trusted",     bg: "rgba(74,222,128,0.12)",  text: "#6EE09A",  border: "rgba(74,222,128,0.35)"  },
  };
  const tierCfg = TIER_CONFIG[tier];

  return (
    <main className="min-h-screen" style={{ background: "hsl(24 14% 4%)", color: "hsl(32 35% 92%)" }}>

      {/* Nav */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          background: "hsl(24 14% 4% / 0.92)",
          backdropFilter: "blur(20px)",
          borderBottomColor: "hsl(22 55% 54% / 0.12)",
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest"
            style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.25)", color: "hsl(22 55% 54%)" }}
          >
            Reputation Profile
          </span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto py-10 px-6 flex flex-col gap-8">

        {/* Hero */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-5">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-2xl font-semibold"
            style={{
              background: "hsl(22 55% 54% / 0.15)",
              border: "1px solid hsl(22 55% 54% / 0.3)",
              color: "hsl(22 55% 54%)",
              fontFamily: "var(--font-inter-tight)",
            }}
          >
            {displayName.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1
                style={{
                  fontFamily: "var(--font-inter-tight), sans-serif",
                  fontWeight: 300,
                  fontSize: "clamp(22px, 4vw, 30px)",
                  color: "hsl(32 35% 92%)",
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </h1>
              {/* Tier badge */}
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
                style={{ background: tierCfg.bg, color: tierCfg.text, border: `1px solid ${tierCfg.border}` }}
              >
                {tierCfg.label}
              </span>
            </div>

            {user.bio && (
              <p className="text-sm leading-relaxed max-w-xl" style={{ color: "hsl(30 10% 62%)" }}>
                {user.bio}
              </p>
            )}

            {user.website && (
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs"
                style={{ color: "#7DB8F7" }}
              >
                {user.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Milestones Completed",
              value: String(total),
              sub: total === 1 ? "milestone" : "milestones",
              color: "#E8935A",
            },
            {
              label: "On-Time Rate",
              value: onTimeRate !== null ? `${Math.round(onTimeRate * 100)}%` : "—",
              sub: "completed before deadline",
              color: onTimeRate !== null
                ? onTimeRate >= 0.8 ? "#6EE09A" : onTimeRate >= 0.5 ? "#D4A03C" : "#F87171"
                : "hsl(30 10% 62%)",
            },
            {
              label: "Avg AI Confidence",
              value: avgConf !== null ? `${Math.round(avgConf)}%` : "—",
              sub: "across approved proofs",
              color: avgConf !== null
                ? avgConf >= 80 ? "#6EE09A" : avgConf >= 60 ? "#D4A03C" : "#F87171"
                : "hsl(30 10% 62%)",
            },
            {
              label: "Avg Resubmissions",
              value: avgResub !== null ? avgResub.toFixed(1) : "—",
              sub: "before approval",
              color: avgResub !== null
                ? avgResub <= 1 ? "#6EE09A" : avgResub <= 2 ? "#D4A03C" : "#F87171"
                : "hsl(30 10% 62%)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-2xl flex flex-col gap-1.5"
              style={{
                background: "hsl(24 12% 6% / 0.5)",
                border: "1px solid hsl(22 55% 54% / 0.12)",
                borderTop: "1px solid hsl(22 55% 54% / 0.3)",
              }}
            >
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(30 10% 62%)" }}>
                {stat.label}
              </span>
              <span
                className="text-2xl font-bold"
                style={{ color: stat.color, fontFamily: "var(--font-inter-tight)" }}
              >
                {stat.value}
              </span>
              <span className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>{stat.sub}</span>
            </div>
          ))}
        </div>

        {/* Category breakdown */}
        {total > 0 && (
          <div
            className="p-5 rounded-2xl flex flex-col gap-4"
            style={{
              background: "hsl(24 12% 6% / 0.5)",
              border: "1px solid hsl(22 55% 54% / 0.12)",
            }}
          >
            <h2 className="text-xs uppercase tracking-widest font-semibold" style={{ color: "hsl(22 55% 54%)" }}>
              Milestone Categories
            </h2>
            <div className="flex flex-wrap gap-2">
              {REPUTATION_CATEGORIES.map((cat) => {
                const count = categories[cat] ?? 0;
                if (count === 0) return null;
                const cfg = CATEGORY_COLORS[cat];
                return (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                  >
                    {CATEGORY_LABELS[cat]}
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold"
                      style={{ background: cfg.border, color: cfg.text }}
                    >
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Public milestone cards */}
        {publicMilestones.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs uppercase tracking-widest font-semibold" style={{ color: "hsl(22 55% 54%)" }}>
              Verified Achievements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {publicMilestones.map((ms) => {
                const cat = (ms.reputationCategory ?? "OTHER") as ReputationCategory;
                const cfg = CATEGORY_COLORS[cat];
                return (
                  <div
                    key={ms.id}
                    className="p-4 rounded-2xl flex flex-col gap-3"
                    style={{
                      background: "hsl(24 12% 6% / 0.5)",
                      border: "1px solid hsl(22 55% 54% / 0.12)",
                      borderTop: `1px solid ${cfg.border}`,
                    }}
                  >
                    {/* Category badge */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                      >
                        {CATEGORY_LABELS[cat]}
                      </span>
                      {/* Verified checkmark */}
                      <div className="flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <circle cx="6.5" cy="6.5" r="6.5" fill="rgba(74,222,128,0.15)" />
                          <path d="M4 6.5l2 2 3.5-3.5" stroke="#6EE09A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs font-medium" style={{ color: "#6EE09A" }}>Verified</span>
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-sm leading-relaxed" style={{ color: "hsl(32 35% 92%)" }}>
                      {ms.reputationSummary}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs" style={{ color: "hsl(28 14% 36%)" }}>
                      <span>
                        <strong style={{ color: "#D4B896" }}>${Number(ms.amountUSD).toLocaleString()}</strong>{" "}RLUSD
                      </span>
                      <span>{new Date(ms.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : total > 0 ? (
          <div
            className="p-5 rounded-2xl text-center"
            style={{
              background: "hsl(24 12% 6% / 0.3)",
              border: "1px solid hsl(22 55% 54% / 0.1)",
            }}
          >
            <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
              No public milestone cards yet — the startup has not opted in to share achievements publicly.
            </p>
          </div>
        ) : (
          <div
            className="p-8 rounded-2xl flex flex-col items-center gap-3 text-center"
            style={{
              background: "hsl(24 12% 6% / 0.3)",
              border: "1px dashed hsl(22 55% 54% / 0.2)",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.2)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>No milestones completed yet</p>
            <p className="text-xs max-w-xs" style={{ color: "hsl(30 10% 62%)" }}>
              This startup&apos;s on-chain track record will appear here as milestones are verified and completed.
            </p>
          </div>
        )}

        {/* Powered by cascrow footer note */}
        <div className="flex items-center justify-center gap-2 pt-4 pb-8">
          <span className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>
            Verified on-chain by
          </span>
          <Link
            href="/"
            className="text-xs font-medium tracking-widest"
            style={{ color: "hsl(22 55% 54%)" }}
          >
            cascrow
          </Link>
          <span className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>
            · Milestone-based grant escrow
          </span>
        </div>
      </div>
    </main>
  );
}
