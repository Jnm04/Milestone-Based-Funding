import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import { EnterpriseOnboardingChecklist } from "@/components/enterprise-onboarding-checklist";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  VERIFIED:        { label: "Verified",        color: "#059669", bg: "#ECFDF5" },
  COMPLETED:       { label: "Completed",        color: "#059669", bg: "#ECFDF5" },
  PENDING:         { label: "Pending",          color: "#D97706", bg: "#FFFBEB" },
  FUNDED:          { label: "Active",           color: "#2563EB", bg: "#EFF6FF" },
  PROOF_SUBMITTED: { label: "Under Review",     color: "#7C3AED", bg: "#F5F3FF" },
  REJECTED:        { label: "Not Met",          color: "#DC2626", bg: "#FEF2F2" },
  AWAITING_ESCROW: { label: "Setup Required",   color: "#D97706", bg: "#FFFBEB" },
  DRAFT:           { label: "Draft",            color: "#64748B", bg: "#F8FAFC" },
  EXPIRED:         { label: "Expired",          color: "#94A3B8", bg: "#F8FAFC" },
};

export default async function EnterpriseDashboardPage() {
  const session = await getServerSession(authOptions);
  const { effectiveUserId: userId } = await getEnterpriseContext(session!.user.id);

  // Onboarding checklist data
  const [teamMemberCount, attestationRunCount, auditorCount] = await Promise.all([
    prisma.orgMember.count({ where: { ownerId: userId, acceptedAt: { not: null } } }),
    prisma.attestationEntry.count({ where: { milestone: { contract: { investorId: userId } } } }),
    prisma.auditorClientAccess.count({ where: { clientId: userId } }),
  ]);

  // Load all contracts + their milestones for this user
  const contracts = await prisma.contract.findMany({
    where: { investorId: userId },
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalContracts = contracts.length;
  const totalMilestones = contracts.reduce((s, c) => s + c.milestones.length, 0);
  const verifiedMilestones = contracts.reduce(
    (s, c) => s + c.milestones.filter((m) => ["VERIFIED", "COMPLETED"].includes(m.status)).length,
    0
  );
  const activeMilestones = contracts.reduce(
    (s, c) => s + c.milestones.filter((m) => ["FUNDED", "PROOF_SUBMITTED"].includes(m.status)).length,
    0
  );
  const upcomingDeadlines = contracts
    .flatMap((c) =>
      c.milestones
        .filter((m) => !["COMPLETED", "EXPIRED", "REJECTED"].includes(m.status) && new Date(m.cancelAfter) > new Date())
        .map((m) => ({ title: m.title, contract: c.milestone, deadline: m.cancelAfter, status: m.status }))
    )
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const recentMilestones = contracts
    .flatMap((c) =>
      c.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        contractTitle: c.milestone,
        contractId: c.id,
        contractMode: c.mode,
        status: m.status,
        amountUSD: Number(m.amountUSD),
        deadline: m.cancelAfter,
        updatedAt: m.updatedAt,
      }))
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  const onChainCount = contracts.flatMap((c) => c.milestones).filter((m) => m.nftTxHash || m.evmTxHash).length;

  // Trend: attestation entries per month for the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const trendEntries = await prisma.attestationEntry.findMany({
    where: {
      milestone: { contract: { investorId: userId } },
      createdAt: { gte: sixMonthsAgo },
    },
    select: { createdAt: true, aiVerdict: true },
  });

  const trendMonths: { label: string; total: number; yes: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth();
    const label = d.toLocaleDateString("en", { month: "short", year: "2-digit" });
    const entries = trendEntries.filter((e) => {
      const ed = new Date(e.createdAt);
      return ed.getFullYear() === y && ed.getMonth() === m;
    });
    trendMonths.push({ label, total: entries.length, yes: entries.filter((e) => e.aiVerdict === "YES").length });
  }

  const summaryCards = [
    {
      label: "Total Attestations",
      value: totalMilestones,
      sub: `across ${totalContracts} goal set${totalContracts !== 1 ? "s" : ""}`,
      accent: "#2563EB",
      bg: "#EFF6FF",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      label: "Verified",
      value: verifiedMilestones,
      sub: totalMilestones > 0 ? `${Math.round((verifiedMilestones / totalMilestones) * 100)}% success rate` : "No attestations yet",
      accent: "#059669",
      bg: "#ECFDF5",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ),
    },
    {
      label: "Active",
      value: activeMilestones,
      sub: "currently under evaluation",
      accent: "#7C3AED",
      bg: "#F5F3FF",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
    },
    {
      label: "On-Chain Records",
      value: onChainCount,
      sub: "immutable blockchain entries",
      accent: "#D97706",
      bg: "#FFFBEB",
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
    },
  ];

  const s = {
    card: {
      background: "white",
      border: "1px solid var(--ent-border)",
      borderRadius: 12,
      padding: "24px",
    } as React.CSSProperties,
    th: {
      padding: "10px 16px",
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.07em",
      color: "var(--ent-muted)",
      borderBottom: "1px solid var(--ent-border)",
      textAlign: "left" as const,
      background: "var(--ent-bg)",
    } as React.CSSProperties,
    td: {
      padding: "13px 16px",
      fontSize: 13.5,
      color: "var(--ent-text)",
      borderBottom: "1px solid var(--ent-border)",
    } as React.CSSProperties,
  };

  function StatusBadge({ status }: { status: string }) {
    const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#64748B", bg: "#F8FAFC" };
    return (
      <span style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
      }}>
        {cfg.label}
      </span>
    );
  }

  function daysUntil(date: Date | string) {
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
    if (diff < 0) return <span style={{ color: "#DC2626", fontWeight: 600 }}>Overdue</span>;
    if (diff === 0) return <span style={{ color: "#D97706", fontWeight: 600 }}>Today</span>;
    if (diff <= 7) return <span style={{ color: "#D97706", fontWeight: 600 }}>In {diff}d</span>;
    return <span style={{ color: "var(--ent-muted)" }}>In {diff}d</span>;
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Overview
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Onboarding checklist */}
      <EnterpriseOnboardingChecklist
        hasGoalSet={totalContracts > 0}
        hasTeamMember={teamMemberCount > 0}
        hasAttestationRun={attestationRunCount > 0}
        hasAuditor={auditorCount > 0}
      />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        {summaryCards.map((card) => (
          <div key={card.label} style={s.card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: card.bg,
                color: card.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ent-text)", letterSpacing: "-0.03em", lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ent-text)", marginTop: 6 }}>{card.label}</div>
            <div style={{ fontSize: 12, color: "var(--ent-muted)", marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      {trendEntries.length > 0 && (() => {
        const chartW = 600;
        const chartH = 120;
        const barW = 52;
        const gap = (chartW - trendMonths.length * barW) / (trendMonths.length + 1);
        const maxVal = Math.max(1, ...trendMonths.map((m) => m.total));
        return (
          <div style={{ ...s.card, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Attestation Trend</h2>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ent-muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#2563EB", display: "inline-block" }} />
                  All runs
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#059669", display: "inline-block" }} />
                  Verified (YES)
                </span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <svg viewBox={`0 0 ${chartW} ${chartH + 28}`} style={{ width: "100%", display: "block" }}>
                {trendMonths.map((m, i) => {
                  const x = gap + i * (barW + gap);
                  const totalH = Math.round((m.total / maxVal) * chartH);
                  const yesH = Math.round((m.yes / maxVal) * chartH);
                  return (
                    <g key={m.label}>
                      {/* Total bar (background) */}
                      <rect
                        x={x} y={chartH - totalH} width={barW} height={totalH}
                        rx={4} fill="#DBEAFE"
                      />
                      {/* YES bar (foreground) */}
                      {m.yes > 0 && (
                        <rect
                          x={x} y={chartH - yesH} width={barW} height={yesH}
                          rx={4} fill="#2563EB"
                        />
                      )}
                      {/* Total label above bar */}
                      {m.total > 0 && (
                        <text x={x + barW / 2} y={chartH - totalH - 4} textAnchor="middle" fontSize={10} fill="#64748B" fontWeight={600}>
                          {m.total}
                        </text>
                      )}
                      {/* Month label below */}
                      <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={10.5} fill="#94A3B8">
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );
      })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        {/* Recent attestations table */}
        <div style={s.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Recent Attestations</h2>
            <a href="/enterprise/dashboard/attestations" style={{ fontSize: 13, color: "var(--ent-accent)", textDecoration: "none", fontWeight: 500 }}>
              View all →
            </a>
          </div>

          {recentMilestones.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                color: "var(--ent-accent)",
              }}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>No attestations yet</p>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
                Your enterprise dashboard is ready. Create your first goal set to get started.
              </p>
              <a
                href="/enterprise/dashboard/attestations/new"
                style={{
                  display: "inline-block",
                  padding: "9px 20px",
                  background: "var(--ent-accent)",
                  color: "white",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Create attestation
              </a>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={s.th}>Goal</th>
                    <th style={s.th}>Goal Set</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMilestones.map((m) => (
                    <tr key={m.id}>
                      <td style={s.td}>
                        <a
                          href={m.contractMode === "ATTESTATION"
                            ? `/enterprise/dashboard/attestations/${m.contractId}`
                            : `/contract/${m.contractId}`}
                          style={{ color: "var(--ent-text)", textDecoration: "none", fontWeight: 500 }}
                        >
                          {m.title}
                        </a>
                      </td>
                      <td style={{ ...s.td, color: "var(--ent-muted)", fontSize: 12.5 }}>{m.contractTitle}</td>
                      <td style={s.td}><StatusBadge status={m.status} /></td>
                      <td style={s.td}>{daysUntil(m.deadline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming deadlines */}
        <div style={s.card}>
          <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <p style={{ color: "var(--ent-muted)", fontSize: 13 }}>No upcoming deadlines.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {upcomingDeadlines.map((d, i) => {
                const daysLeft = Math.ceil((new Date(d.deadline).getTime() - Date.now()) / 86400000);
                const urgent = daysLeft <= 7;
                return (
                  <div key={i} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px",
                    borderRadius: 8,
                    background: urgent ? "#FFFBEB" : "var(--ent-bg)",
                    border: `1px solid ${urgent ? "#FDE68A" : "var(--ent-border)"}`,
                  }}>
                    <div style={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: 8,
                      background: urgent ? "#FEF3C7" : "#EFF6FF",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: urgent ? "#D97706" : "var(--ent-accent)", lineHeight: 1 }}>
                        {new Date(d.deadline).getDate()}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", color: urgent ? "#D97706" : "var(--ent-accent)" }}>
                        {new Date(d.deadline).toLocaleDateString("en", { month: "short" })}
                      </span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "var(--ent-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.title}
                      </p>
                      <p style={{ margin: 0, fontSize: 11.5, color: "var(--ent-muted)" }}>
                        {daysLeft === 0 ? "Due today" : daysLeft < 0 ? "Overdue" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
