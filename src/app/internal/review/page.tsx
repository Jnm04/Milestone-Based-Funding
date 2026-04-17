"use client";

import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/internal-client";

interface ModelVote { model: string; decision: "YES" | "NO"; confidence: number; reasoning: string }
interface QueueEntry {
  id: string;
  proofId: string;
  milestoneText: string;
  proofText: string;
  fileUrl: string | null;
  modelVotes: ModelVote[];
  consensusLevel: number;
  createdAt: string;
  // reviewed tab fields
  label?: string | null;
  reviewedAt?: string | null;
}

type Tab = "pending" | "reviewed" | "skipped";

const LABEL_COLOR: Record<string, string> = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED: "#f97316",
};

export default function ReviewQueuePage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  // Labeling state
  const [label, setLabel] = useState<"APPROVED" | "REJECTED" | "FAKED" | "">("");
  const [fraudType, setFraudType] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Undo state — stores the last labeled proofId so reviewer can undo
  const [lastLabeled, setLastLabeled] = useState<{ proofId: string; label: string } | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback((t: Tab) => {
    setLoading(true);
    setLastLabeled(null);
    internalFetch(`/api/internal/queue?tab=${t}`)
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries ?? []); setCurrent(0); setLoading(false); });
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const entry = entries[current];

  function resetForm() {
    setLabel("");
    setFraudType("");
    setNotes("");
  }

  async function submit() {
    if (!label || !entry) return;
    setSubmitting(true);
    await internalFetch("/api/internal/queue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proofId: entry.proofId, label, fraudType: fraudType || undefined, notes: notes || undefined }),
    });
    setLastLabeled({ proofId: entry.proofId, label });
    resetForm();
    setSubmitting(false);
    setEntries((prev) => prev.filter((_, i) => i !== current));
    setCurrent((c) => Math.min(c, Math.max(0, entries.length - 2)));
  }

  async function handleSkip() {
    if (!entry) return;
    await internalFetch("/api/internal/queue", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proofId: entry.proofId }),
    });
    setEntries((prev) => prev.filter((_, i) => i !== current));
    setCurrent((c) => Math.min(c, Math.max(0, entries.length - 2)));
  }

  async function handleUndo() {
    if (!lastLabeled) return;
    setUndoing(true);
    await internalFetch("/api/internal/queue", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proofId: lastLabeled.proofId }),
    });
    setUndoing(false);
    setLastLabeled(null);
    load(tab);
  }

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 20,
    border: `1px solid ${tab === t ? "rgba(196,112,75,0.6)" : "rgba(196,112,75,0.2)"}`,
    background: tab === t ? "rgba(196,112,75,0.12)" : "transparent",
    color: tab === t ? "#EDE6DD" : "#A89B8C",
    cursor: "pointer",
    fontSize: 13,
  });

  if (loading) return <p style={{ color: "#A89B8C" }}>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 820 }}>

      {/* Header + tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Review Queue</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>3-2 model split decisions — human label required</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={tabStyle("pending")} onClick={() => setTab("pending")}>Pending</button>
          <button style={tabStyle("skipped")} onClick={() => setTab("skipped")}>Skipped</button>
          <button style={tabStyle("reviewed")} onClick={() => setTab("reviewed")}>Reviewed</button>
        </div>
      </div>

      {/* Undo banner */}
      {lastLabeled && (
        <div style={{ padding: "10px 16px", background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.25)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#A89B8C" }}>
            Saved as <strong style={{ color: LABEL_COLOR[lastLabeled.label] }}>{lastLabeled.label}</strong>
          </span>
          <button onClick={handleUndo} disabled={undoing}
            style={{ fontSize: 12, color: "#C4704B", background: "none", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
            {undoing ? "Undoing…" : "↩ Undo"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 60, color: "#A89B8C" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <p>
            {tab === "pending" ? "No pending entries." : tab === "skipped" ? "No skipped entries." : "No reviewed entries yet."}
          </p>
        </div>
      )}

      {/* ── Reviewed tab — read-only list ── */}
      {tab === "reviewed" && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "#EDE6DD", margin: "0 0 4px" }}>
                  {e.milestoneText.slice(0, 120)}{e.milestoneText.length > 120 ? "…" : ""}
                </p>
                <p style={{ fontSize: 11, color: "#A89B8C", margin: 0 }}>
                  {new Date(e.reviewedAt!).toLocaleDateString()} · consensus {e.consensusLevel}/5
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {e.fileUrl && (
                  <a href={e.fileUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#A89B8C", textDecoration: "none", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 6, padding: "3px 8px" }}>
                    File ↗
                  </a>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: LABEL_COLOR[e.label ?? ""] ?? "#A89B8C" }}>
                  {e.label}
                </span>
                <button
                  onClick={async () => {
                    await internalFetch("/api/internal/queue", {
                      method: "DELETE",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ proofId: e.proofId }),
                    });
                    load(tab);
                  }}
                  style={{ fontSize: 11, color: "#A89B8C", background: "none", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                  ↩ Undo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Skipped tab — list with return-to-pending ── */}
      {tab === "skipped" && entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ padding: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: "#EDE6DD", margin: "0 0 4px" }}>
                  {e.milestoneText.slice(0, 120)}{e.milestoneText.length > 120 ? "…" : ""}
                </p>
                <p style={{ fontSize: 11, color: "#A89B8C", margin: 0 }}>consensus {e.consensusLevel}/5</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {e.fileUrl && (
                  <a href={e.fileUrl} target="_blank" rel="noreferrer"
                    style={{ fontSize: 11, color: "#A89B8C", textDecoration: "none", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 6, padding: "3px 8px" }}>
                    File ↗
                  </a>
                )}
                <button
                  onClick={async () => {
                    await internalFetch("/api/internal/queue", {
                      method: "DELETE",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ proofId: e.proofId }),
                    });
                    load(tab);
                  }}
                  style={{ fontSize: 11, color: "#C4704B", background: "none", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                  Return to pending
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending tab — interactive review card ── */}
      {tab === "pending" && entry && (
        <>
          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#A89B8C", fontSize: 13, margin: 0 }}>{current + 1} of {entries.length}</p>
            <div style={{ padding: "4px 12px", background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 20, fontSize: 12, color: "#C4704B" }}>
              {entry.consensusLevel}-{5 - entry.consensusLevel} split
            </div>
          </div>

          {/* Milestone */}
          <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Milestone</div>
            <p style={{ color: "#EDE6DD", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{entry.milestoneText}</p>
          </div>

          {/* Proof text + file link */}
          <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase" }}>Proof Content</div>
              {entry.fileUrl && (
                <a href={entry.fileUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: "#C4704B", textDecoration: "none", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 6, padding: "4px 10px" }}>
                  Open original file ↗
                </a>
              )}
            </div>
            <pre style={{ color: "#C8BEB4", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 200, overflow: "auto" }}>
              {entry.proofText.slice(0, 1500)}{entry.proofText.length > 1500 ? "\n…" : ""}
            </pre>
          </div>

          {/* Model votes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {entry.modelVotes.map((v) => (
              <div key={v.model} style={{ padding: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${v.decision === "YES" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#A89B8C" }}>{v.model}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: v.decision === "YES" ? "#22c55e" : "#ef4444" }}>{v.decision} · {v.confidence}%</span>
                </div>
                <p style={{ fontSize: 12, color: "#C8BEB4", margin: 0, lineHeight: 1.5 }}>{v.reasoning}</p>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500 }}>Your verdict</div>
            <div style={{ display: "flex", gap: 10 }}>
              {(["APPROVED", "REJECTED", "FAKED"] as const).map((l) => (
                <button key={l} onClick={() => setLabel(l)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8,
                  border: `1px solid ${label === l ? (l === "APPROVED" ? "#22c55e" : l === "REJECTED" ? "#ef4444" : "#f97316") : "rgba(196,112,75,0.2)"}`,
                  background: label === l ? (l === "APPROVED" ? "rgba(34,197,94,0.12)" : l === "REJECTED" ? "rgba(239,68,68,0.12)" : "rgba(249,115,22,0.12)") : "transparent",
                  color: label === l ? (l === "APPROVED" ? "#22c55e" : l === "REJECTED" ? "#ef4444" : "#f97316") : "#A89B8C",
                  cursor: "pointer", fontSize: 13, fontWeight: 500,
                }}>
                  {l === "APPROVED" ? "✓ APPROVED" : l === "REJECTED" ? "✗ REJECTED" : "🚩 FAKED"}
                </button>
              ))}
            </div>

            {label === "FAKED" && (
              <select value={fraudType} onChange={(e) => setFraudType(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(196,112,75,0.2)", background: "#1e1a18", color: "#EDE6DD", fontSize: 13 }}>
                <option value="">Fraud type (optional)</option>
                <option value="AI_GENERATED">AI Generated</option>
                <option value="MANIPULATED">Manipulated / edited</option>
                <option value="RECYCLED">Recycled from another project</option>
                <option value="IMPLAUSIBLE">Implausible data</option>
              </select>
            )}

            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={2}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(196,112,75,0.15)", background: "rgba(255,255,255,0.03)", color: "#EDE6DD", fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />

            <button onClick={submit} disabled={!label || submitting} style={{
              padding: "12px 0", borderRadius: 8,
              background: label ? "#C4704B" : "rgba(196,112,75,0.2)",
              color: "#fff", border: "none", cursor: label ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 500,
            }}>
              {submitting ? "Saving…" : "Save & Next →"}
            </button>
          </div>

          {/* Skip */}
          <button onClick={handleSkip}
            style={{ background: "none", border: "none", color: "#A89B8C", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
            Skip for now → (visible in Skipped tab)
          </button>
        </>
      )}
    </div>
  );
}
