"use client";

import { useState } from "react";

const RISK_CFG = {
  ON_TRACK: { label: "On Track", color: "#16A34A", bg: "#DCFCE7", dot: "#16A34A" },
  AT_RISK: { label: "At Risk", color: "#D97706", bg: "#FEF3C7", dot: "#D97706" },
  LIKELY_MISS: { label: "Likely Miss", color: "#DC2626", bg: "#FEE2E2", dot: "#DC2626" },
};

interface Snapshot {
  id: string;
  capturedAt: string;
  risk: string;
  rawValue: string | null;
  targetValue: string | null;
  confidence: number;
}

interface MilestoneRow {
  id: string;
  title: string;
  contractTitle: string;
  contractId: string;
  pulseCheckEnabled: boolean;
  pulseCheckInterval: string | null;
  lastPulseCheckRisk: string | null;
  predictedOutcome: string | null;
  predictedConfidence: number | null;
  pulseSnapshots: Snapshot[];
}

export function PulseDashboardClient({ milestones: initial }: { milestones: MilestoneRow[] }) {
  const [milestones, setMilestones] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function togglePulse(m: MilestoneRow, enabled: boolean, interval?: string) {
    setSaving(m.id);
    try {
      await fetch(`/api/enterprise/pulse/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pulseCheckEnabled: enabled, pulseCheckInterval: interval ?? m.pulseCheckInterval ?? "WEEKLY" }),
      });
      setMilestones((prev) =>
        prev.map((x) => x.id === m.id ? { ...x, pulseCheckEnabled: enabled, pulseCheckInterval: interval ?? x.pulseCheckInterval } : x)
      );
    } finally {
      setSaving(null);
    }
  }

  const onTrack = milestones.filter((m) => m.lastPulseCheckRisk === "ON_TRACK").length;
  const atRisk = milestones.filter((m) => m.lastPulseCheckRisk === "AT_RISK").length;
  const likelyMiss = milestones.filter((m) => m.lastPulseCheckRisk === "LIKELY_MISS").length;
  const noData = milestones.filter((m) => !m.lastPulseCheckRisk).length;

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "20px 24px",
  };

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "On Track", count: onTrack, color: "#16A34A", bg: "#DCFCE7" },
          { label: "At Risk", count: atRisk, color: "#D97706", bg: "#FEF3C7" },
          { label: "Likely Miss", count: likelyMiss, color: "#DC2626", bg: "#FEE2E2" },
          { label: "No Data Yet", count: noData, color: "var(--ent-muted)", bg: "var(--ent-bg)" },
        ].map(({ label, count, color, bg }) => (
          <div key={label} style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: 12.5, color: "var(--ent-muted)", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {milestones.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "64px 24px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>No attestation milestones found</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)" }}>Create a goal set first to start monitoring pulse checks.</p>
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {milestones.map((m, i) => {
              const risk = m.lastPulseCheckRisk;
              const cfg = risk ? RISK_CFG[risk as keyof typeof RISK_CFG] : null;
              const snapshots = m.pulseSnapshots;
              const isSaving = saving === m.id;

              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 20,
                    padding: "18px 0",
                    borderBottom: i < milestones.length - 1 ? "1px solid var(--ent-border)" : "none",
                  }}
                >
                  {/* Left: title + contract */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>{m.title}</p>
                      {cfg && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontSize: 11.5, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                          color: cfg.color, background: cfg.bg,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--ent-muted)" }}>
                      <a href={`/enterprise/dashboard/attestations/${m.contractId}`} style={{ color: "var(--ent-muted)", textDecoration: "none" }}>
                        {m.contractTitle}
                      </a>
                    </p>

                    {/* Sparkline */}
                    {snapshots.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
                        {[...snapshots].reverse().map((s) => {
                          const sc = RISK_CFG[s.risk as keyof typeof RISK_CFG];
                          return (
                            <div
                              key={s.id}
                              title={`${s.risk} — ${new Date(s.capturedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}${s.rawValue ? ` — ${s.rawValue}` : ""}`}
                              style={{
                                width: 10, height: 10, borderRadius: "50%",
                                background: sc?.dot ?? "#D1D5DB",
                                flexShrink: 0,
                              }}
                            />
                          );
                        })}
                        <span style={{ fontSize: 11.5, color: "var(--ent-muted)", marginLeft: 4 }}>last {snapshots.length} checks</span>
                      </div>
                    )}

                    {/* Latest values */}
                    {snapshots[0]?.rawValue && (
                      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>
                        Latest: <strong style={{ color: "var(--ent-text)" }}>{snapshots[0].rawValue}</strong>
                        {snapshots[0].targetValue && <> / target <strong style={{ color: "var(--ent-text)" }}>{snapshots[0].targetValue}</strong></>}
                      </p>
                    )}

                    {/* Prediction */}
                    {m.predictedOutcome && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                        AI prediction: <strong style={{ color: m.predictedOutcome === "YES" ? "#16A34A" : "#DC2626" }}>{m.predictedOutcome}</strong>
                        {m.predictedConfidence !== null && <> ({Math.round(m.predictedConfidence * 100)}% confidence)</>}
                      </p>
                    )}
                  </div>

                  {/* Right: toggle */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>Pulse</span>
                      <button
                        disabled={isSaving}
                        onClick={() => togglePulse(m, !m.pulseCheckEnabled)}
                        style={{
                          width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                          background: m.pulseCheckEnabled ? "var(--ent-accent)" : "#D1D5DB",
                          position: "relative", transition: "background 0.2s", opacity: isSaving ? 0.5 : 1,
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3, left: m.pulseCheckEnabled ? 21 : 3,
                          width: 16, height: 16, borderRadius: "50%", background: "white",
                          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </button>
                    </div>
                    {m.pulseCheckEnabled && (
                      <select
                        value={m.pulseCheckInterval ?? "WEEKLY"}
                        disabled={isSaving}
                        onChange={(e) => togglePulse(m, true, e.target.value)}
                        style={{
                          fontSize: 12, padding: "4px 8px", borderRadius: 6,
                          border: "1px solid var(--ent-border)", color: "var(--ent-text)",
                          background: "white", cursor: "pointer",
                        }}
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Bi-weekly</option>
                        <option value="MID_PERIOD">Mid-period</option>
                      </select>
                    )}
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
