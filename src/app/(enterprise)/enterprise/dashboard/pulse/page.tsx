import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import { prisma } from "@/lib/prisma";
import { PulseDashboardClient } from "./pulse-client";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const { effectiveUserId } = await getEnterpriseContext(session.user.id);

  const contracts = await prisma.contract.findMany({
    where: { investorId: effectiveUserId, mode: "ATTESTATION" },
    select: {
      id: true,
      milestone: true,
      milestones: {
        select: {
          id: true,
          title: true,
          pulseCheckEnabled: true,
          pulseCheckInterval: true,
          lastPulseCheckRisk: true,
          predictedOutcome: true,
          predictedConfidence: true,
          pulseSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 8,
            select: {
              id: true,
              capturedAt: true,
              risk: true,
              rawValue: true,
              targetValue: true,
              confidence: true,
            },
          },
        },
      },
    },
  });

  const milestones = contracts.flatMap((c) =>
    c.milestones.map((m) => ({
      ...m,
      contractTitle: c.milestone,
      contractId: c.id,
      pulseSnapshots: m.pulseSnapshots.map((s) => ({
        ...s,
        capturedAt: s.capturedAt.toISOString(),
      })),
    }))
  );

  const riskOrder: Record<string, number> = { LIKELY_MISS: 0, AT_RISK: 1, ON_TRACK: 2 };
  milestones.sort((a, b) => {
    const ra = riskOrder[a.lastPulseCheckRisk ?? ""] ?? 3;
    const rb = riskOrder[b.lastPulseCheckRisk ?? ""] ?? 3;
    return ra - rb;
  });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 960 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Pulse Monitoring
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          Continuous early-warning checks between official attestation runs
        </p>
      </div>

      <div style={{
        background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10,
        padding: "14px 20px", marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start",
      }}>
        <svg width="18" height="18" fill="none" stroke="#2563EB" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p style={{ margin: 0, fontSize: 13, color: "#1E40AF", lineHeight: 1.55 }}>
          Pulse checks run automatically based on the schedule you set per milestone. Enable pulse monitoring to get early warnings before your official attestation deadline. AI uses the same data source as your attestation to estimate current progress.
        </p>
      </div>

      <PulseDashboardClient milestones={milestones} />
    </div>
  );
}
