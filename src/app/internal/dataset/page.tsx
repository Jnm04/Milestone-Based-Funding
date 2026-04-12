"use client";

import { useEffect, useState } from "react";

interface ModelVote {
  model: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
}

interface TrainingEntry {
  id: string;
  proofId: string;
  milestoneText: string;
  proofText: string;
  label: string;
  labelSource: string;
  consensusLevel: number;
  fraudType: string | null;
  modelVotes: ModelVote[];
  notes: string | null;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
}

const LABEL_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED: "#f97316",
};

const DECISION_COLOR: Record<string, string> = {
  YES: "#22c55e",
  NO: "#ef4444",
};

const SOURCE_LABELS: Record<string, string> = {
  AUTO_5_0: "Auto 5-0",
  AUTO_4_1: "Auto 4-1",
  HUMAN: "Human",
  GRANT_GIVER: "Grant Giver",
};

const GEN_SOURCE_LABEL: Record<string, string> = {
  "source:synthetic": "Synthetic",
  "source:arxiv":     "arXiv",
  "source:github":    "GitHub",
};
const GEN_SOURCE_COLOR: Record<string, string> = {
  "source:synthetic": "#a855f7",
  "source:arxiv":     "#3b82f6",
  "source:github":    "#6b7280",
};

function parseSource(notes: string | null): { tag: string | null; rest: string | null } {
  if (!notes) return { tag: null, rest: null };
  const key = Object.keys(GEN_SOURCE_LABEL).find((k) => notes.startsWith(k));
  if (key) {
    const rest = notes.slice(key.length).replace(/^[\s\-–:]+/, "").trim() || null;
    return { tag: key, rest };
  }
  return { tag: null, rest: notes };
}

const PAGE_SIZE = 50;

export default function DatasetPage() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<"jsonl" | "csv" | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<{ saved: number; queued: number; generated: number } | null>(null);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  function loadEntries() {
    setLoading(true);
    fetch(`/api/internal/dataset?limit=${PAGE_SIZE}&offset=0`, { headers: { "x-internal-key": key() } })
      .then((r) => (r.ok ? r.json() : { entries: [], total: 0 }))
      .then((d) => {
        setEntries(d.entries ?? []);
        setTotal(d.total ?? (d.entries ?? []).length);
        setOffset((d.entries ?? []).length);
        setLoading(false);
      });
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/internal/dataset?limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { "x-internal-key": key() },
      });
      if (!res.ok) return;
      const d = await res.json();
      setEntries((prev) => [...prev, ...(d.entries ?? [])]);
      setOffset((prev) => prev + (d.entries ?? []).length);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { loadEntries(); }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBootstrap() {
    setBootstrapping(true);
    setBootstrapResult(null);
    try {
      const res = await fetch("/api/internal/dataset/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": key() },
        body: JSON.stringify({ pairsPerCombo: 2 }),
      });
      const d = await res.json() as { saved?: number; queued?: number; generated?: number; error?: string };
      if (d.error) { alert(d.error); return; }
      setBootstrapResult({ saved: d.saved ?? 0, queued: d.queued ?? 0, generated: d.generated ?? 0 });
      loadEntries();
    } finally {
      setBootstrapping(false);
    }
  }

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
          <p style={{ color: "#A89B8C", fontSize: 13 }}>
            {entries.length}{total > entries.length ? ` of ${total}` : ""} labeled entries (most recent first){" "}
            <button onClick={loadEntries} disabled={loading} style={{ background: "none", border: "none", color: "#C4704B", cursor: "pointer", fontSize: 13, padding: 0, marginLeft: 8 }}>
              {loading ? "…" : "↻ Refresh"}
            </button>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={runBootstrap}
            disabled={bootstrapping}
            title="Generate 16 synthetic pairs across all domains and auto-save high-consensus results"
            style={{
              padding: "8px 16px", borderRadius: 8, background: bootstrapping ? "rgba(168,155,140,0.1)" : "rgba(196,112,75,0.15)",
              color: bootstrapping ? "#A89B8C" : "#C4704B",
              border: "1px solid rgba(196,112,75,0.3)", cursor: bootstrapping ? "default" : "pointer", fontSize: 13,
            }}
          >
            {bootstrapping ? "Bootstrapping…" : "⚡ Bootstrap Brain"}
          </button>
          {bootstrapResult && (
            <span style={{ fontSize: 12, color: "#6EE09A" }}>
              ✓ {bootstrapResult.saved} saved, {bootstrapResult.queued} queued ({bootstrapResult.generated} generated)
            </span>
          )}
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
      </div>

      {entries.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#A89B8C", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12 }}>
          No entries yet. Run verifications or use the Sandbox to generate training data.
        </div>
      )}

      {entries.length < total && (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "rgba(196,112,75,0.1)",
              border: "1px solid rgba(196,112,75,0.25)",
              color: "#C4704B",
              fontSize: 13,
              cursor: loadingMore ? "default" : "pointer",
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? "Loading…" : `Load more (${total - entries.length} remaining)`}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {entries.map((e) => {
          const isOpen = expanded.has(e.id);
          const votes: ModelVote[] = Array.isArray(e.modelVotes) ? e.modelVotes : [];
          const { tag: srcTag, rest: srcRest } = parseSource(e.notes);
          return (
            <div
              key={e.id}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${isOpen ? "rgba(196,112,75,0.3)" : "rgba(196,112,75,0.12)"}`,
                borderRadius: 10,
                overflow: "hidden",
                transition: "border-color 0.15s",
              }}
            >
              {/* ── Collapsed row ── */}
              <div
                onClick={() => toggleExpand(e.id)}
                style={{
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 12,
                  alignItems: "center",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <div>
                  <p style={{ fontSize: 13, color: "#EDE6DD", margin: "0 0 4px" }}>
                    {e.milestoneText.slice(0, 120)}{e.milestoneText.length > 120 ? "…" : ""}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#A89B8C" }}>{new Date(e.createdAt).toLocaleDateString()}</span>
                    <span style={{ fontSize: 11, color: "#A89B8C" }}>Consensus: {e.consensusLevel}/{e.modelVotes.length || 5}</span>
                    <span style={{ fontSize: 11, color: "#A89B8C" }}>{SOURCE_LABELS[e.labelSource] ?? e.labelSource}</span>
                    {srcTag && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: GEN_SOURCE_COLOR[srcTag],
                        background: `${GEN_SOURCE_COLOR[srcTag]}18`,
                        border: `1px solid ${GEN_SOURCE_COLOR[srcTag]}40`,
                        borderRadius: 4, padding: "1px 6px", letterSpacing: "0.05em",
                      }}>
                        {GEN_SOURCE_LABEL[srcTag]}
                      </span>
                    )}
                    {e.fraudType && <span style={{ fontSize: 11, color: "#f97316" }}>{e.fraudType}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: LABEL_COLORS[e.label] ?? "#A89B8C", whiteSpace: "nowrap" }}>
                  {e.label}
                </span>
                <span style={{ fontSize: 11, color: "#A89B8C", opacity: 0.6 }}>{isOpen ? "▲" : "▼"}</span>
              </div>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(196,112,75,0.15)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>

                  {/* Milestone */}
                  <div>
                    <p style={{ fontSize: 11, color: "#A89B8C", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 1 }}>Milestone</p>
                    <p style={{ fontSize: 13, color: "#EDE6DD", margin: 0, lineHeight: 1.6 }}>{e.milestoneText}</p>
                  </div>

                  {/* Proof text */}
                  {e.proofText && (
                    <div>
                      <p style={{ fontSize: 11, color: "#A89B8C", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 1 }}>
                        Extracted Proof Text
                        {e.fileName && <span style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>— {e.fileName}</span>}
                      </p>
                      <div style={{
                        maxHeight: 200, overflowY: "auto", background: "rgba(0,0,0,0.25)", borderRadius: 8,
                        padding: "10px 14px", fontSize: 12, color: "#A89B8C", lineHeight: 1.7,
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {e.proofText.slice(0, 5_000)}{e.proofText.length > 5_000 ? "\n\n[truncated…]" : ""}
                      </div>
                      {e.fileUrl && (
                        <a
                          href={e.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "#C4704B" }}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          Open original file ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Model votes */}
                  {votes.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, color: "#A89B8C", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>Model Votes</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {votes.map((v) => (
                          <div key={v.model} style={{
                            display: "grid", gridTemplateColumns: "100px 40px 54px 1fr",
                            gap: 12, alignItems: "start",
                            padding: "8px 12px", borderRadius: 7,
                            background: "rgba(0,0,0,0.2)",
                          }}>
                            <span style={{ fontSize: 12, color: "#EDE6DD", fontWeight: 500 }}>{v.model}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: DECISION_COLOR[v.decision] ?? "#A89B8C" }}>{v.decision}</span>
                            <span style={{ fontSize: 11, color: "#A89B8C" }}>{v.confidence}%</span>
                            <span style={{ fontSize: 11, color: "#A89B8C", lineHeight: 1.5 }}>{v.reasoning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {srcRest && (
                    <div>
                      <p style={{ fontSize: 11, color: "#A89B8C", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 1 }}>Notes</p>
                      <p style={{ fontSize: 13, color: "#EDE6DD", margin: 0, lineHeight: 1.6 }}>{srcRest}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
