import { notFound } from "next/navigation";
import Link from "next/link";

const VERDICT_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  YES:          { label: "Verified",     color: "#065F46", bg: "#D1FAE5", border: "#6EE7B7", icon: "✓" },
  NO:           { label: "Not Met",      color: "#991B1B", bg: "#FEE2E2", border: "#FCA5A5", icon: "✗" },
  INCONCLUSIVE: { label: "Inconclusive", color: "#92400E", bg: "#FEF3C7", border: "#FCD34D", icon: "~" },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  VERIFIED:        { label: "Verified",      color: "#059669", bg: "#ECFDF5" },
  COMPLETED:       { label: "Completed",     color: "#059669", bg: "#ECFDF5" },
  PENDING:         { label: "Pending",       color: "#64748B", bg: "#F8FAFC" },
  FUNDED:          { label: "Ready",         color: "#2563EB", bg: "#EFF6FF" },
  PROOF_SUBMITTED: { label: "Under Review",  color: "#D97706", bg: "#FFFBEB" },
  REJECTED:        { label: "Rejected",      color: "#DC2626", bg: "#FEF2F2" },
};

interface MilestoneEntry {
  period: string;
  verdict: string;
  reasoning: string | null;
  certUrl: string | null;
  xrplTxHash: string | null;
  xrplUrl: string | null;
  runAt: string;
  type: string;
}

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string;
  regulatoryTags: string[];
  dataSourceType: string | null;
  latestEntry: MilestoneEntry | null;
  totalRuns: number;
  verifiedRuns: number;
}

interface VerifyData {
  id: string;
  title: string;
  createdAt: string;
  totalMilestones: number;
  verifiedMilestones: number;
  milestones: Milestone[];
  xrplExplorer: string;
  verifiedAt: string;
}

async function getData(id: string): Promise<VerifyData | null> {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/enterprise/verify/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<VerifyData>;
  } catch {
    return null;
  }
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  const passRate = data.milestones.reduce((sum, m) => sum + m.verifiedRuns, 0) /
    Math.max(1, data.milestones.reduce((sum, m) => sum + m.totalRuns, 0));
  const passRatePct = Math.round(passRate * 100);

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      {/* Header bar */}
      <div style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 15, color: "#111827", textDecoration: "none", letterSpacing: "-0.02em" }}>
          cascrow
        </Link>
        <span style={{ fontSize: 12, color: "#6B7280" }}>Public Attestation Record</span>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>

        {/* Verified banner */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28, padding: "18px 22px", background: data.verifiedMilestones > 0 ? "#D1FAE5" : "#F3F4F6", border: `1px solid ${data.verifiedMilestones > 0 ? "#6EE7B7" : "#E5E7EB"}`, borderRadius: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: data.verifiedMilestones > 0 ? "#059669" : "#9CA3AF",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            {data.verifiedMilestones > 0 ? "✓" : "·"}
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: data.verifiedMilestones > 0 ? "#065F46" : "#374151" }}>
              {data.verifiedMilestones > 0
                ? `${data.verifiedMilestones} of ${data.totalMilestones} milestone${data.totalMilestones !== 1 ? "s" : ""} verified`
                : "No verified milestones yet"}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: data.verifiedMilestones > 0 ? "#065F46" : "#6B7280" }}>
              AI-verified · Anchored on XRP Ledger Mainnet · Pass rate {passRatePct}%
            </p>
          </div>
        </div>

        {/* Goal set header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
            {data.title}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
            Created {new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}Record ID: <span style={{ fontFamily: "monospace", fontSize: 11.5 }}>{data.id.slice(0, 16)}</span>
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { label: "Milestones", value: data.totalMilestones, color: "#2563EB" },
            { label: "Verified", value: data.verifiedMilestones, color: "#059669" },
            { label: "Pass Rate", value: `${passRatePct}%`, color: passRatePct >= 70 ? "#059669" : passRatePct >= 40 ? "#D97706" : "#DC2626" },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF" }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Milestones */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {data.milestones.map((m, idx) => {
            const statusCfg = STATUS_CFG[m.status] ?? { label: m.status, color: "#64748B", bg: "#F8FAFC" };
            const verdict = m.latestEntry ? (VERDICT_CFG[m.latestEntry.verdict] ?? null) : null;
            return (
              <div key={m.id} style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
                {/* Milestone header */}
                <div style={{ padding: "18px 22px", borderBottom: m.latestEntry ? "1px solid #F3F4F6" : "none", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF" }}>#{idx + 1}</span>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>{m.title}</h3>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, color: statusCfg.color, background: statusCfg.bg }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {m.description && (
                      <p style={{ margin: "0 0 6px", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{m.description}</p>
                    )}
                    {m.regulatoryTags.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {m.regulatoryTags.map((tag) => (
                          <span key={tag} style={{ fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 4, background: "#F3F4F6", color: "#374151" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0, textAlign: "right" }}>
                    <span>Deadline {new Date(m.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    {m.totalRuns > 0 && (
                      <div style={{ marginTop: 4 }}>{m.verifiedRuns}/{m.totalRuns} runs verified</div>
                    )}
                  </div>
                </div>

                {/* Latest verdict */}
                {m.latestEntry && verdict && (
                  <div style={{ padding: "16px 22px", background: verdict.bg, borderTop: `2px solid ${verdict.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: m.latestEntry.reasoning ? 10 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: verdict.color }}>{verdict.icon} {verdict.label}</span>
                        <span style={{ fontSize: 11.5, color: verdict.color, opacity: 0.7, fontFamily: "monospace" }}>{m.latestEntry.period}</span>
                        {m.latestEntry.type === "AUDITOR_RERUN" && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#EDE9FE", color: "#7C3AED" }}>Auditor</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {m.latestEntry.certUrl && (
                          <a href={m.latestEntry.certUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, color: verdict.color, textDecoration: "none", padding: "3px 10px", border: `1px solid ${verdict.border}`, borderRadius: 5 }}>
                            Certificate ↗
                          </a>
                        )}
                        {m.latestEntry.xrplUrl && (
                          <a href={m.latestEntry.xrplUrl} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, fontWeight: 600, color: verdict.color, textDecoration: "none", padding: "3px 10px", border: `1px solid ${verdict.border}`, borderRadius: 5 }}>
                            XRPL ↗
                          </a>
                        )}
                      </div>
                    </div>
                    {m.latestEntry.reasoning && (
                      <p style={{ margin: 0, fontSize: 13, color: verdict.color, lineHeight: 1.55, opacity: 0.85, fontStyle: "italic" }}>
                        &ldquo;{m.latestEntry.reasoning.length > 400
                          ? m.latestEntry.reasoning.slice(0, 400) + "…"
                          : m.latestEntry.reasoning}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer disclaimer */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E5E7EB" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF" }}>
            Attestation Methodology
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#6B7280", lineHeight: 1.65 }}>
            Each attestation run fetches live data from the configured source and submits it to five independent AI models
            (Anthropic Claude, Google Gemini, OpenAI GPT, Mistral, Cerebras). A majority vote of ≥ 3/5 YES verdicts is required
            for a VERIFIED result. Every run is anchored to the XRP Ledger mainnet via an AccountSet transaction memo,
            providing an immutable, timestamped audit trail independent of cascrow infrastructure.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>
              Powered by <strong style={{ color: "#C4704B" }}>cascrow</strong> · cascrow.com
            </span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "#D1D5DB" }}>{data.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
