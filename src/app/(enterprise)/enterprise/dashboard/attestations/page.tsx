import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

function getGoalSetStatus(milestones: { status: string }[]): { label: string; color: string; bg: string } {
  if (milestones.length === 0) return { label: "Active", color: "#D97706", bg: "#FFFBEB" };
  if (milestones.every((m) => m.status === "COMPLETED")) {
    return { label: "Completed", color: "#059669", bg: "#ECFDF5" };
  }
  if (milestones.some((m) => m.status === "VERIFIED")) {
    return { label: "In Progress", color: "#2563EB", bg: "#EFF6FF" };
  }
  return { label: "Active", color: "#D97706", bg: "#FFFBEB" };
}

export default async function AttestationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const goalSets = await prisma.contract.findMany({
    where: { investorId: session.user.id, mode: "ATTESTATION" },
    include: { milestones: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

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

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            Goal Sets
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
            Manage and track your AI-verified attestation goal sets
          </p>
        </div>
        <Link
          href="/enterprise/dashboard/attestations/new"
          style={{
            background: "var(--ent-accent)",
            color: "white",
            border: "none",
            borderRadius: 7,
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Goal Set
        </Link>
      </div>

      {goalSets.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: "72px 24px" }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            color: "var(--ent-accent)",
          }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--ent-text)" }}>
            No goal sets yet
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--ent-muted)", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Goal sets let you define milestones and get AI-verified attestations for each one.
          </p>
          <Link
            href="/enterprise/dashboard/attestations/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 20px",
              background: "var(--ent-accent)",
              color: "white",
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create your first goal set
          </Link>
        </div>
      ) : (
        <div style={s.card}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={s.th}>Goal Set</th>
                  <th style={s.th}>Milestones</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Last Updated</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {goalSets.map((gs) => {
                  const verifiedCount = gs.milestones.filter((m) =>
                    ["VERIFIED", "COMPLETED"].includes(m.status)
                  ).length;
                  const totalCount = gs.milestones.length;
                  const status = getGoalSetStatus(gs.milestones);
                  return (
                    <tr key={gs.id}>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600, color: "var(--ent-text)" }}>{gs.milestone}</span>
                      </td>
                      <td style={s.td}>
                        <span style={{ fontSize: 13, color: "var(--ent-muted)" }}>
                          {verifiedCount}/{totalCount} verified
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 9px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          color: status.color,
                          background: status.bg,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: "var(--ent-muted)", fontSize: 13 }}>
                        {new Date(gs.updatedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td style={s.td}>
                        <Link
                          href={`/enterprise/dashboard/attestations/${gs.id}`}
                          style={{
                            background: "white",
                            color: "var(--ent-text)",
                            border: "1px solid var(--ent-border)",
                            borderRadius: 7,
                            padding: "6px 14px",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            textDecoration: "none",
                            display: "inline-block",
                          }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
