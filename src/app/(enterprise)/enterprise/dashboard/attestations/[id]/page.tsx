import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AttestationDetail } from "./attestation-detail";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import Link from "next/link";

export default async function AttestationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { effectiveUserId, role: userRole } = await getEnterpriseContext(session.user.id);

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
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
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!contract || contract.investorId !== effectiveUserId || contract.mode !== "ATTESTATION") {
    redirect("/enterprise/dashboard/attestations");
  }

  const goalSet = { id: contract.id, title: contract.milestone, requiresApproval: contract.requiresApproval };
  const milestones = contract.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.status,
    cancelAfter: m.cancelAfter.toISOString(),
    order: m.order,
    dataSourceType: m.dataSourceType,
    dataSourceUrl: m.dataSourceUrl,
    dataSourceApiKeyHint: m.dataSourceApiKeyHint,
    dataSourceLockedAt: m.dataSourceLockedAt?.toISOString() ?? null,
    scheduleType: m.scheduleType,
    attestationCertUrl: m.attestationCertUrl,
    attestationFetchedAt: m.attestationFetchedAt?.toISOString() ?? null,
    regulatoryTags: (() => { try { return JSON.parse(m.regulatoryTags ?? "[]") as string[]; } catch { return []; } })(),
    latestEntries: m.attestationEntries.map((e) => ({
      id: e.id,
      period: e.period,
      aiVerdict: e.aiVerdict,
      aiReasoning: e.aiReasoning,
      xrplTxHash: e.xrplTxHash,
      certUrl: e.certUrl,
      type: e.type,
      createdAt: e.createdAt.toISOString(),
    })),
    internalApprovalStatus: m.internalApprovalStatus,
    internalApprovedBy: m.internalApprovedBy,
    internalApprovedAt: m.internalApprovedAt?.toISOString() ?? null,
    internalApprovalNote: m.internalApprovalNote,
    dataSourceConnector: m.dataSourceConnector ?? null,
    connectorStatus: m.connectorStatus ?? null,
    connectorLastHealthy: m.connectorLastHealthy?.toISOString() ?? null,
  }));

  const verifiedCount = milestones.filter((m) =>
    ["VERIFIED", "COMPLETED"].includes(m.status)
  ).length;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/enterprise/dashboard/attestations"
          style={{
            fontSize: 13,
            color: "var(--ent-muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 16,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Goal Sets
        </Link>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
              {contract.milestone}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
              {milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · {verifiedCount} verified ·{" "}
              Created {new Date(contract.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
            <a
              href={`/verify/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "white",
                color: "var(--ent-text)",
                border: "1px solid var(--ent-border)",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Public Link
            </a>
            <a
              href={`/api/enterprise/attestations/${id}/report`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--ent-accent, #C4704B)",
                color: "white",
                border: "none",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Board Report
            </a>
            <a
              href={`/api/enterprise/attestations/${id}/export`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "white",
                color: "var(--ent-text)",
                border: "1px solid var(--ent-border)",
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </a>
          </div>
        </div>
      </div>

      <AttestationDetail goalSet={goalSet} milestones={milestones} userRole={userRole} />
    </div>
  );
}
