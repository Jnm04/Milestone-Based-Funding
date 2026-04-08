"use client";

import { useEffect, useState } from "react";

interface TrainingEntry {
  id: string;
  proofId: string;
  milestoneText: string;
  label: string;
  labelSource: string;
  consensusLevel: number;
  fraudType: string | null;
  createdAt: string;
}

const LABEL_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED: "#f97316",
};

const SOURCE_LABELS: Record<string, string> = {
  AUTO_5_0: "Auto 5-0",
  AUTO_4_1: "Auto 4-1",
  HUMAN: "Human",
  GRANT_GIVER: "Grant Giver",
};

export default function DatasetPage() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"jsonl" | "csv" | null>(null);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  useEffect(() => {
    fetch("/api/internal/dataset", { headers: { "x-internal-key": key() } })
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => { setEntries(d.entries ?? []); setLoading(false); });
  }, []);

  async function downloadExport(format: "jsonl" | "csv") {
    setExporting(format);
    const res = await fetch(`/api/internal/export?format=${format}`, {
      headers: { "x-internal-key": key() },
    });
    if (!res.ok) { setExporting(null); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cascrow-dataset-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(null);
  }

  if (loading) return <p style={{ color: "#A89B8C" }}>Loading dataset…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Training Dataset</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>{entries.length} labeled entries (most recent first)</p>
        </div>
        {entries.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => downloadExport("jsonl")} disabled={exporting !== null} style={{
              padding: "8px 16px", borderRadius: 8, background: "rgba(196,112,75,0.1)", color: "#C4704B",
              border: "1px solid rgba(196,112,75,0.3)", cursor: "pointer", fontSize: 13,
              opacity: exporting ? 0.6 : 1,
            }}>
              {exporting === "jsonl" ? "Exporting…" : "↓ JSONL (fine-tuning)"}
            </button>
            <button onClick={() => downloadExport("csv")} disabled={exporting !== null} style={{
              padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.04)", color: "#A89B8C",
              border: "1px solid rgba(196,112,75,0.15)", cursor: "pointer", fontSize: 13,
              opacity: exporting ? 0.6 : 1,
            }}>
              {exporting === "csv" ? "Exporting…" : "↓ CSV"}
            </button>
          </div>
        )}
      </div>

      {entries.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#A89B8C", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12 }}>
          No entries yet. Run verifications or use the Sandbox to generate training data.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((e) => (
          <div key={e.id} style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" }}>
            <div>
              <p style={{ fontSize: 13, color: "#EDE6DD", margin: "0 0 4px" }}>{e.milestoneText.slice(0, 120)}{e.milestoneText.length > 120 ? "…" : ""}</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#A89B8C" }}>{new Date(e.createdAt).toLocaleDateString()}</span>
                <span style={{ fontSize: 11, color: "#A89B8C" }}>Consensus: {e.consensusLevel}/5</span>
                <span style={{ fontSize: 11, color: "#A89B8C" }}>{SOURCE_LABELS[e.labelSource] ?? e.labelSource}</span>
                {e.fraudType && <span style={{ fontSize: 11, color: "#f97316" }}>{e.fraudType}</span>}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: LABEL_COLORS[e.label] ?? "#A89B8C", whiteSpace: "nowrap" }}>
              {e.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
