export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Platform Stats | cascrow",
  description: "Live transparency dashboard — contracts created, RLUSD locked, AI verification results, and milestone completion rates on cascrow.",
};

export default async function StatsPage() {
  const [
    totalContracts,
    completedContracts,
    activeContracts,
    totalMilestones,
    completedMilestones,
    totalProofs,
    aiResults,
    rlusdLocked,
    totalUsers,
  ] = await Promise.all([
    // All contracts ever created (excluding pure drafts with no startup)
    prisma.contract.count(),

    // Completed contracts
    prisma.contract.count({ where: { status: "COMPLETED" } }),

    // Active contracts (money currently locked or in progress)
    prisma.contract.count({
      where: {
        status: { in: ["AWAITING_ESCROW", "FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW", "VERIFIED"] },
      },
    }),

    // Total milestones
    prisma.milestone.count(),

    // Completed milestones
    prisma.milestone.count({ where: { status: "COMPLETED" } }),

    // Total proofs submitted
    prisma.proof.count(),

    // AI decisions for approval rate + avg confidence
    prisma.proof.findMany({
      where: { aiDecision: { not: null } },
      select: { aiDecision: true, aiConfidence: true },
    }),

    // Sum of amountUSD across all non-DRAFT contracts (total value transacted/locked)
    prisma.contract.aggregate({
      where: { status: { not: "DRAFT" } },
      _sum: { amountUSD: true },
    }),

    // Registered users
    prisma.user.count(),
  ]);

  const aiTotal = aiResults.length;
  const aiApproved = aiResults.filter((p) => p.aiDecision === "YES").length;
  const aiApprovalRate = aiTotal > 0 ? Math.round((aiApproved / aiTotal) * 100) : null;

  const confidenceValues = aiResults
    .map((p) => p.aiConfidence)
    .filter((c): c is number => c !== null);
  const avgConfidence =
    confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
      : null;

  const totalRLUSD = rlusdLocked._sum.amountUSD
    ? Number(rlusdLocked._sum.amountUSD)
    : 0;

  const milestoneCompletionRate =
    totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : null;

  const stats: Array<{
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
  }> = [
    {
      label: "Total RLUSD Transacted",
      value: `$${totalRLUSD.toLocaleString()}`,
      sub: "across all non-draft contracts",
      accent: true,
    },
    {
      label: "Contracts Created",
      value: totalContracts.toLocaleString(),
      sub: `${completedContracts} completed · ${activeContracts} active`,
    },
    {
      label: "Milestones",
      value: totalMilestones.toLocaleString(),
      sub: milestoneCompletionRate !== null
        ? `${completedMilestones} completed (${milestoneCompletionRate}%)`
        : "none completed yet",
    },
    {
      label: "Proofs Submitted",
      value: totalProofs.toLocaleString(),
      sub: "PDF & GitHub proof submissions",
    },
    {
      label: "AI Approval Rate",
      value: aiApprovalRate !== null ? `${aiApprovalRate}%` : "—",
      sub: aiTotal > 0 ? `${aiApproved} approved of ${aiTotal} reviewed` : "no reviews yet",
    },
    {
      label: "Avg AI Confidence",
      value: avgConfidence !== null ? `${avgConfidence}%` : "—",
      sub: "5-model majority vote consensus",
    },
    {
      label: "Registered Users",
      value: totalUsers.toLocaleString(),
      sub: "grant givers & receivers",
    },
  ];

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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest"
            style={{
              background: "hsl(22 55% 54% / 0.1)",
              border: "1px solid hsl(22 55% 54% / 0.25)",
              color: "hsl(22 55% 54%)",
            }}
          >
            Stats
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto py-14 px-6 flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs uppercase tracking-widest font-medium"
            style={{ color: "hsl(22 55% 54%)" }}
          >
            ← Home
          </Link>
          <h1
            className="mt-2 tracking-tight"
            style={{
              fontFamily: "var(--font-inter-tight), sans-serif",
              fontWeight: 300,
              fontSize: "clamp(28px, 5vw, 40px)",
              color: "hsl(32 35% 92%)",
            }}
          >
            Platform Transparency
          </h1>
          <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
            Live stats from the cascrow platform — updated on every page load.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="p-5 rounded-2xl flex flex-col gap-1.5"
              style={{
                background: s.accent
                  ? "hsl(22 55% 54% / 0.07)"
                  : "hsl(24 12% 6% / 0.5)",
                border: s.accent
                  ? "1px solid hsl(22 55% 54% / 0.3)"
                  : "1px solid hsl(22 55% 54% / 0.12)",
                borderTop: s.accent ? "1px solid hsl(22 55% 54%)" : undefined,
              }}
            >
              <span
                className="text-xs uppercase tracking-widest font-medium"
                style={{ color: s.accent ? "hsl(22 55% 54%)" : "hsl(30 10% 62%)" }}
              >
                {s.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-inter-tight), sans-serif",
                  fontWeight: 300,
                  fontSize: "clamp(28px, 5vw, 36px)",
                  color: "hsl(32 35% 92%)",
                  lineHeight: 1.1,
                }}
              >
                {s.value}
              </span>
              {s.sub && (
                <span className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>
                  {s.sub}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-center" style={{ color: "hsl(24 16% 20%)" }}>
          All escrow activity is publicly verifiable on the{" "}
          <a
            href="https://xrpscan.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "hsl(28 14% 36%)", textDecoration: "underline" }}
          >
            XRP Ledger
          </a>{" "}
          and XRPL EVM Sidechain.
        </p>
      </div>
    </main>
  );
}
