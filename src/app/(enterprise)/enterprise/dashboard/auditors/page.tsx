import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AuditorShare } from "./auditor-share";

export default async function AuditorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const goalSets = await prisma.contract.findMany({
    where: { investorId: session.user.id, mode: "ATTESTATION" },
    select: { id: true, milestone: true, createdAt: true, milestones: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "24px",
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Auditor Access
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          Share read-only access to specific goal sets with external auditors
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        borderRadius: 10,
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}>
        <svg width="20" height="20" fill="none" stroke="#2563EB" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 600, color: "#1D4ED8" }}>
            How auditor sharing works
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#1E40AF", lineHeight: 1.55 }}>
            Share read-only access to specific goal sets with external auditors.
            Shared links provide view-only access to goal set details, milestone status, and certificates.
            No account required for auditors — links are publicly accessible with just the URL.
          </p>
        </div>
      </div>

      {goalSets.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "64px 24px" }}>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
            No goal sets to share
          </p>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--ent-muted)" }}>
            Create a goal set first, then you can share it with auditors.
          </p>
          <a
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
            Create goal set
          </a>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {goalSets.map((gs, index) => {
              const verifiedCount = gs.milestones.filter((m) =>
                ["VERIFIED", "COMPLETED"].includes(m.status)
              ).length;
              const totalCount = gs.milestones.length;

              return (
                <div
                  key={gs.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "16px 0",
                    borderBottom: index < goalSets.length - 1 ? "1px solid var(--ent-border)" : "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {gs.milestone}
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>
                      {totalCount} milestone{totalCount !== 1 ? "s" : ""} · {verifiedCount} verified ·{" "}
                      Created {new Date(gs.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <a
                      href={`/enterprise/dashboard/attestations/${gs.id}`}
                      style={{
                        background: "white",
                        color: "var(--ent-text)",
                        border: "1px solid var(--ent-border)",
                        borderRadius: 7,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 500,
                        cursor: "pointer",
                        textDecoration: "none",
                        display: "inline-block",
                      }}
                    >
                      View
                    </a>
                    <AuditorShare contractId={gs.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
