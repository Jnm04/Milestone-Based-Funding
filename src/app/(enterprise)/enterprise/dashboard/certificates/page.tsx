import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export default async function CertificatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const { effectiveUserId } = await getEnterpriseContext(session.user.id);

  const milestones = await prisma.milestone.findMany({
    where: {
      contract: { investorId: effectiveUserId, mode: "ATTESTATION" },
      attestationEntries: { some: { aiVerdict: "YES" } },
    },
    include: {
      contract: { select: { milestone: true, id: true } },
      attestationEntries: {
        where: { aiVerdict: "YES" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, period: true, certUrl: true, xrplTxHash: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const s = {
    card: {
      background: "white",
      border: "1px solid var(--ent-border)",
      borderRadius: 12,
      padding: "24px",
    } as React.CSSProperties,
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Certificates
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          AI-verified, blockchain-anchored attestation certificates
        </p>
      </div>

      {milestones.length === 0 ? (
        <div style={{ ...s.card, textAlign: "center", padding: "72px 24px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#ECFDF5", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 20px", color: "#059669",
          }}>
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "var(--ent-text)" }}>
            No certificates yet
          </p>
          <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--ent-muted)", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
            Certificates are issued when a milestone attestation returns a YES verdict. Configure a data source and run your first attestation.
          </p>
          <Link
            href="/enterprise/dashboard/attestations/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 20px", background: "var(--ent-accent)", color: "white",
              borderRadius: 7, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            Create a goal set
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
          {milestones.map((m) => {
            const entry = m.attestationEntries[0];
            return (
              <div key={m.id} style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Certificate preview */}
                <div style={{ width: "100%", aspectRatio: "16/9", background: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
                  {entry?.certUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.certUrl}
                      alt={`Certificate for ${m.title}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: 20 }}>
                      <svg width="40" height="40" fill="none" stroke="#86EFAC" strokeWidth={1.25} viewBox="0 0 24 24" style={{ margin: "0 auto 8px" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                      <p style={{ margin: 0, fontSize: 11.5, color: "#86EFAC", fontWeight: 500 }}>Verified</p>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 700, color: "var(--ent-text)", lineHeight: 1.3 }}>
                    {m.title}
                  </p>
                  <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ent-muted)" }}>
                    {m.contract.milestone}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ent-muted)" }}>
                        Period
                      </p>
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-text)", fontWeight: 500, fontFamily: "monospace" }}>
                        {entry?.period ?? "—"}
                      </p>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: "#059669", background: "#ECFDF5" }}>
                      ✓ Verified
                    </span>
                  </div>

                  {/* Links */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--ent-border)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {entry?.certUrl && (
                      <a
                        href={entry.certUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 600, color: "var(--ent-accent)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--ent-border)", borderRadius: 5 }}
                      >
                        View Certificate ↗
                      </a>
                    )}
                    {entry?.xrplTxHash && (
                      <a
                        href={`https://xrpscan.com/tx/${entry.xrplTxHash}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--ent-border)", borderRadius: 5 }}
                      >
                        XRPL ↗
                      </a>
                    )}
                    <Link
                      href={`/enterprise/dashboard/attestations/${m.contract.id}`}
                      style={{ fontSize: 12, color: "var(--ent-muted)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--ent-border)", borderRadius: 5 }}
                    >
                      Goal Set
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
