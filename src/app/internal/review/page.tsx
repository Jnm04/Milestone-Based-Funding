"use client";

import { useEffect, useState } from "react";

interface ModelVote { model: string; decision: "YES" | "NO"; confidence: number; reasoning: string }
interface QueueEntry {
  id: string;
  proofId: string;
  milestoneText: string;
  proofText: string;
  modelVotes: ModelVote[];
  consensusLevel: number;
  createdAt: string;
}

export default function ReviewQueuePage() {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [label, setLabel] = useState<"APPROVED" | "REJECTED" | "FAKED" | "">("");
  const [fraudType, setFraudType] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  useEffect(() => {
    fetch("/api/internal/queue", { headers: { "x-internal-key": key() } })
      .then((r) => r.json())
      .then((d) => { setEntries(d.entries ?? []); setLoading(false); });
  }, []);

  const entry = entries[current];

  async function submit() {
    if (!label || !entry) return;
    setSubmitting(true);
    await fetch("/api/internal/queue", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key() },
      body: JSON.stringify({ proofId: entry.proofId, label, fraudType: fraudType || undefined, notes: notes || undefined }),
    });
    setLabel("");
    setFraudType("");
    setNotes("");
    setSubmitting(false);
    if (current + 1 >= entries.length) setDone(true);
    else setCurrent((c) => c + 1);
  }

  if (loading) return <p style={{ color: "#A89B8C" }}>Loading queue…</p>;
  if (done || entries.length === 0) {
    return (
      <div style={{ textAlign: "center", paddingTop: 80, color: "#A89B8C" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <p>No pending entries. All 3-2 splits have been reviewed.</p>
      </div>
    );
  }

  const yesModels = entry.modelVotes.filter((v) => v.decision === "YES");
  const noModels = entry.modelVotes.filter((v) => v.decision === "NO");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Review Queue</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>{current + 1} of {entries.length} — 3-2 split decisions needing human label</p>
        </div>
        <div style={{ padding: "6px 14px", background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 20, fontSize: 12, color: "#C4704B" }}>
          {entry.consensusLevel}-{5 - entry.consensusLevel} split
        </div>
      </div>

      {/* Milestone */}
      <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
        <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Milestone</div>
        <p style={{ color: "#EDE6DD", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{entry.milestoneText}</p>
      </div>

      {/* Proof text */}
      <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
        <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Proof Content (truncated)</div>
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

      {/* Label selector */}
      <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 12, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500 }}>Your verdict</div>
        <div style={{ display: "flex", gap: 10 }}>
          {(["APPROVED", "REJECTED", "FAKED"] as const).map((l) => (
            <button key={l} onClick={() => setLabel(l)} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${label === l ? (l === "APPROVED" ? "#22c55e" : l === "REJECTED" ? "#ef4444" : "#f97316") : "rgba(196,112,75,0.2)"}`,
              background: label === l ? (l === "APPROVED" ? "rgba(34,197,94,0.12)" : l === "REJECTED" ? "rgba(239,68,68,0.12)" : "rgba(249,115,22,0.12)") : "transparent",
              color: label === l ? (l === "APPROVED" ? "#22c55e" : l === "REJECTED" ? "#ef4444" : "#f97316") : "#A89B8C",
              cursor: "pointer", fontSize: 13, fontWeight: 500,
            }}>{l === "APPROVED" ? "✓ APPROVED" : l === "REJECTED" ? "✗ REJECTED" : "🚩 FAKED"}</button>
          ))}
        </div>

        {label === "FAKED" && (
          <select value={fraudType} onChange={(e) => setFraudType(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(196,112,75,0.2)", background: "#1e1a18", color: "#EDE6DD", fontSize: 13 }}>
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
          padding: "12px 0", borderRadius: 8, background: label ? "#C4704B" : "rgba(196,112,75,0.2)",
          color: "#fff", border: "none", cursor: label ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 500,
        }}>
          {submitting ? "Saving…" : "Save & Next →"}
        </button>
      </div>

      {/* Skip */}
      <button onClick={() => setCurrent((c) => Math.min(c + 1, entries.length - 1))}
        style={{ background: "none", border: "none", color: "#A89B8C", cursor: "pointer", fontSize: 13, textAlign: "left" }}>
        Skip this entry →
      </button>
    </div>
  );
}
