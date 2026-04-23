import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AuditorPanel } from "./auditor-panel";

export const dynamic = "force-dynamic";

const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  VERIFIED:        { label: "Verified",       color: "#059669", bg: "#ECFDF5" },
  COMPLETED:       { label: "Completed",       color: "#059669", bg: "#ECFDF5" },
  PENDING:         { label: "Pending",         color: "#D97706", bg: "#FFFBEB" },
  FUNDED:          { label: "Active",          color: "#2563EB", bg: "#EFF6FF" },
  PROOF_SUBMITTED: { label: "Under Review",    color: "#7C3AED", bg: "#F5F3FF" },
  REJECTED:        { label: "Not Met",         color: "#DC2626", bg: "#FEF2F2" },
  AWAITING_ESCROW: { label: "Setup Required",  color: "#D97706", bg: "#FFFBEB" },
  DRAFT:           { label: "Draft",           color: "#64748B", bg: "#F8FAFC" },
  EXPIRED:         { label: "Expired",         color: "#94A3B8", bg: "#F8FAFC" },
  PENDING_REVIEW:  { label: "Under Review",    color: "#7C3AED", bg: "#F5F3FF" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#64748B", bg: "#F8FAFC" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      id: true,
      milestone: true,
      mode: true,
      auditorEmail: true,
      createdAt: true,
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          scheduleType: true,
          dataSourceType: true,
          dataSourceLockedAt: true,
          regulatoryTags: true,
          cancelAfter: true,
          attestationEntries: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              period: true,
              aiVerdict: true,
              aiReasoning: true,
              xrplTxHash: true,
              certUrl: true,
              type: true,
              auditorEmail: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!contract || contract.mode !== "ATTESTATION") notFound();

  const verifiedCount = contract.milestones.filter((m) =>
    ["VERIFIED", "COMPLETED"].includes(m.status)
  ).length;
  const totalCount = contract.milestones.length;
  const totalRuns = contract.milestones.reduce((s, m) => s + m.attestationEntries.length, 0);

  const milestoneShapes = contract.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    scheduleType: m.scheduleType,
    dataSourceType: m.dataSourceType,
    dataSourceLockedAt: m.dataSourceLockedAt?.toISOString() ?? null,
  }));

  const existingEntries = Object.fromEntries(
    contract.milestones.map((m) => [
      m.id,
      m.attestationEntries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
    ])
  );

  const hasAuditorAccess = !!contract.auditorEmail;

  return (
    <div style={{ minHeight: "100vh", background: "var(--ent-bg)" }}>
      {/* Top bar */}
      <div style={{
        background: "white",
        borderBottom: "1px solid var(--ent-border)",
        padding: "0 32px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: "var(--ent-accent)",
            borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 9c0-2.761 2.239-5 5-5s5 2.239 5 5-2.239 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="9" r="1.5" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>cascrow</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11.5, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.07em", color: "var(--ent-muted)",
            padding: "4px 10px", border: "1px solid var(--ent-border)", borderRadius: 5,
          }}>
            Audit Report · Read-only
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        {/* Goal set header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{
            margin: "0 0 8px",
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--ent-muted)",
          }}>
            Enterprise KPI Attestation Report
          </p>
          <h1 style={{
            margin: "0 0 12px", fontSize: 28, fontWeight: 800,
            color: "var(--ent-text)", letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>
            {contract.milestone}
          </h1>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, color: "var(--ent-muted)" }}>
              {verifiedCount} of {totalCount} milestone{totalCount !== 1 ? "s" : ""} verified
            </span>
            <span style={{ fontSize: 13.5, color: "var(--ent-muted)" }}>
              {totalRuns} attestation run{totalRuns !== 1 ? "s" : ""}
            </span>
            <span style={{ fontSize: 13.5, color: "var(--ent-muted)" }}>
              Created {new Date(contract.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div style={{
            background: "white",
            border: "1px solid var(--ent-border)",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ent-text)" }}>Verification Progress</span>
                <span style={{ fontSize: 13, color: "var(--ent-muted)" }}>
                  {verifiedCount}/{totalCount}
                </span>
              </div>
              <div style={{ height: 8, background: "#E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0}%`,
                  background: verifiedCount === totalCount ? "#059669" : "var(--ent-accent)",
                  borderRadius: 8,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>
            {verifiedCount === totalCount && totalCount > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#059669",
                background: "#ECFDF5", padding: "6px 12px", borderRadius: 20,
                whiteSpace: "nowrap",
              }}>
                ✓ All verified
              </span>
            )}
          </div>
        )}

        {/* Milestones overview */}
        <div style={{
          background: "white",
          border: "1px solid var(--ent-border)",
          borderRadius: 12,
          overflow: "hidden",
          marginBottom: 32,
        }}>
          <div style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--ent-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
              Milestones
            </h2>
          </div>

          <div>
            {contract.milestones.map((m, idx) => {
              const latest = m.attestationEntries[0];
              return (
                <div
                  key={m.id}
                  style={{
                    padding: "16px 24px",
                    borderBottom: idx < contract.milestones.length - 1 ? "1px solid var(--ent-border)" : "none",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: ["VERIFIED", "COMPLETED"].includes(m.status) ? "#ECFDF5" : "var(--ent-bg-alt)",
                    color: ["VERIFIED", "COMPLETED"].includes(m.status) ? "#059669" : "var(--ent-muted)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {["VERIFIED", "COMPLETED"].includes(m.status) ? (
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>{m.title}</p>
                      <StatusBadge status={m.status} />
                    </div>
                    {m.description && (
                      <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.5 }}>
                        {m.description}
                      </p>
                    )}
                    {m.regulatoryTags && (() => {
                      let tags: string[] = [];
                      try { tags = JSON.parse(m.regulatoryTags) as string[]; } catch { /**/ }
                      return tags.length > 0 ? (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                          {tags.map((t) => (
                            <span key={t} style={{
                              fontSize: 11, fontWeight: 600,
                              color: t.startsWith("CSRD") ? "#059669" : t.startsWith("SDG") ? "#2563EB" : t.startsWith("GRI") ? "#7C3AED" : "#D97706",
                              background: t.startsWith("CSRD") ? "#ECFDF5" : t.startsWith("SDG") ? "#EFF6FF" : t.startsWith("GRI") ? "#F5F3FF" : "#FFFBEB",
                              padding: "2px 7px", borderRadius: 4,
                            }}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {latest && (
                        <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
                          Last run: {new Date(latest.createdAt).toLocaleDateString("en-GB")} · Period {latest.period}
                        </span>
                      )}
                      {m.scheduleType && (
                        <span style={{ fontSize: 12, color: "var(--ent-muted)", fontFamily: "monospace" }}>
                          {m.scheduleType}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
                        Deadline: {new Date(m.cancelAfter).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    {latest && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {latest.certUrl && (
                          <a href={latest.certUrl} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 12, fontWeight: 600, color: "var(--ent-accent)",
                            textDecoration: "none", padding: "3px 9px",
                            border: "1px solid var(--ent-border)", borderRadius: 5,
                          }}>
                            Certificate ↗
                          </a>
                        )}
                        {latest.xrplTxHash && (
                          <a href={`${XRPL_EXPLORER}/transactions/${latest.xrplTxHash}`} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 12, fontWeight: 600, color: "var(--ent-muted)",
                            textDecoration: "none", padding: "3px 9px",
                            border: "1px solid var(--ent-border)", borderRadius: 5,
                          }}>
                            XRPL ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auditor section */}
        {hasAuditorAccess && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--ent-text)" }}>
                Independent Auditor Verification
              </h2>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.6 }}>
                As the registered auditor for this goal set, you can trigger independent AI verification runs.
                Each run fetches live data from the locked source, evaluates it independently, and creates a
                tamper-proof record on the XRP Ledger.
              </p>
            </div>

            <AuditorPanel
              contractId={contract.id}
              milestones={milestoneShapes}
              existingEntries={existingEntries}
              xrplExplorer={XRPL_EXPLORER}
            />
          </div>
        )}

        {/* Trust footer */}
        <div style={{
          marginTop: 40,
          paddingTop: 24,
          borderTop: "1px solid var(--ent-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" fill="none" stroke="var(--ent-muted)" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
              AI-verified · XRP Ledger anchored · Tamper-proof
            </span>
          </div>
          <Link href="/" style={{ fontSize: 12, color: "var(--ent-muted)", textDecoration: "none" }}>
            Powered by cascrow.com
          </Link>
        </div>
      </div>
    </div>
  );
}
