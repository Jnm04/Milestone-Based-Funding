"use client";

import { useState } from "react";

interface ModelVote { model: string; decision: "YES" | "NO"; confidence: number; reasoning: string }

interface GeneratedResult {
  milestoneText: string;
  proofText: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  decision: "YES" | "NO";
  reasoning: string;
  confidence: number;
  modelVotes: ModelVote[];
  consensusLevel: number;
}

const DECISION_COLOR: Record<string, string> = { YES: "#22c55e", NO: "#ef4444" };

const DOMAINS = [
  { value: "legal",     label: "Legal / Compliance" },
  { value: "technical", label: "Technical / Software" },
  { value: "business",  label: "Business / Traction" },
  { value: "research",  label: "Research / Analysis" },
];

const OUTCOMES = [
  { value: "approved", label: "Approved (clearly meets milestone)" },
  { value: "rejected", label: "Rejected (clearly does not meet)" },
  { value: "mixed",    label: "Mixed (ambiguous / partial)" },
];

function consensusColor(level: number): string {
  if (level >= 4) return "#22c55e";
  if (level === 3) return "#eab308";
  return "#ef4444";
}

export default function GeneratePage() {
  const [tab, setTab]         = useState<"synthetic" | "public">("synthetic");
  const [domain, setDomain]   = useState("technical");
  const [outcome, setOutcome] = useState("mixed");
  const [count, setCount]     = useState(3);
  const [source, setSource]   = useState<"arxiv" | "github">("arxiv");
  const [keyword, setKeyword] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError]     = useState("");
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [saving, setSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  async function generate() {
    setRunning(true);
    setError("");
    setResults([]);
    setSelected(new Set());
    setSavedCount(0);

    const body = tab === "synthetic"
      ? { mode: "synthetic", domain, outcome, count }
      : { mode: "public", source, keyword: keyword.trim(), outcome, count };

    const res = await fetch("/api/internal/generate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key() },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Generation failed. Check API keys.");
      setRunning(false);
      return;
    }

    const data = await res.json() as { results: GeneratedResult[] };
    setResults(data.results ?? []);

    // Auto-select high-consensus results
    const autoSelected = new Set<number>();
    data.results?.forEach((r, i) => { if (r.consensusLevel >= 4) autoSelected.add(i); });
    setSelected(autoSelected);
    setRunning(false);
  }

  function toggleSelect(i: number) {
    setSelected(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  function toggleExpand(i: number) {
    setExpanded(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });
  }

  function selectAll() {
    setSelected(new Set(results.map((_, i) => i)));
  }

  function selectHighConsensus() {
    setSelected(new Set(results.map((_, i) => i).filter(i => results[i].consensusLevel >= 4)));
  }

  async function saveSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    setError("");
    const toSave = [...selected].map(i => results[i]);
    const responses = await Promise.all(toSave.map(r =>
      fetch("/api/internal/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json", "x-internal-key": key() },
        body: JSON.stringify({
          milestoneText: r.milestoneText,
          proofText: r.proofText,
          saveToDataset: true,
          precomputedVotes: r.modelVotes,
          precomputedConsensusLevel: r.consensusLevel,
          precomputedDecision: r.decision,
          precomputedExtractedText: r.proofText,
          notes: tab === "synthetic" ? "source:synthetic" : `source:${source}`,
        }),
      })
    ));
    const failed = responses.filter(r => !r.ok).length;
    if (failed > 0) {
      const bodies = await Promise.all(responses.filter(r => !r.ok).map(r => r.json().catch(() => ({}))));
      setError(`${failed} save(s) failed: ${bodies.map((b: { detail?: string; error?: string }) => b.detail ?? b.error ?? "unknown").join("; ")}`);
    }
    setSavedCount(toSave.length - failed);
    setSaving(false);
    setSelected(new Set());
  }

  const sel = (style: object, active: boolean) => ({
    ...style,
    ...(active ? { borderColor: "rgba(196,112,75,0.6)", color: "#EDE6DD" } : {}),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Training Data Generator</h1>
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Generate synthetic or web-sourced milestone+proof pairs, verify with 5 models, save the best ones.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(196,112,75,0.15)" }}>
        {([["synthetic", "Synthetic"], ["public", "From Web"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); setResults([]); setError(""); }}
            style={{ padding: "9px 20px", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#C4704B" : "transparent"}`, color: tab === t ? "#EDE6DD" : "#A89B8C", cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 500 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Config */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "18px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 12 }}>

        {tab === "synthetic" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Domain</label>
              <select value={domain} onChange={e => setDomain(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.2)", color: "#EDE6DD", fontSize: 13 }}>
                {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Intended Outcome</label>
              <select value={outcome} onChange={e => setOutcome(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.2)", color: "#EDE6DD", fontSize: 13 }}>
                {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {tab === "public" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Source</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["arxiv", "github"] as const).map(s => (
                    <button key={s} onClick={() => setSource(s)} style={sel({
                      padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(196,112,75,0.2)", color: "#A89B8C", cursor: "pointer", fontSize: 13,
                    }, source === s)}>
                      {s === "arxiv" ? "arXiv papers" : "GitHub repos"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Intended Outcome</label>
                <select value={outcome} onChange={e => setOutcome(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.2)", color: "#EDE6DD", fontSize: 13 }}>
                  {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Search keyword
              </label>
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder={source === "arxiv" ? "e.g. GDPR compliance blockchain, crop monitoring drone…" : "e.g. medical device software, precision agriculture…"}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.2)", color: "#EDE6DD", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
          </div>
        )}

        {/* Count + Generate */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase" }}>Count</label>
            {[1, 2, 3, 5].map(n => (
              <button key={n} onClick={() => setCount(n)} style={sel({
                width: 36, height: 32, borderRadius: 7, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(196,112,75,0.2)", color: "#A89B8C", cursor: "pointer", fontSize: 13,
              }, count === n)}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={running || (tab === "public" && !keyword.trim())} style={{
            padding: "10px 28px", borderRadius: 8, background: "#C4704B", color: "#fff", border: "none",
            cursor: running || (tab === "public" && !keyword.trim()) ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 500, opacity: running || (tab === "public" && !keyword.trim()) ? 0.6 : 1,
          }}>
            {running ? `Generating ${count} pair${count > 1 ? "s" : ""}…` : "Generate & Verify"}
          </button>
          {running && <span style={{ fontSize: 12, color: "#A89B8C" }}>Running 5 models per pair — takes ~20s</span>}
        </div>
      </div>

      {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#A89B8C" }}>{results.length} results</span>
              <button onClick={selectHighConsensus} style={{ padding: "5px 12px", borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22c55e", cursor: "pointer", fontSize: 11 }}>
                Select 4-5/5 only
              </button>
              <button onClick={selectAll} style={{ padding: "5px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(196,112,75,0.15)", color: "#A89B8C", cursor: "pointer", fontSize: 11 }}>
                Select all
              </button>
            </div>
            {selected.size > 0 && (
              <button onClick={saveSelected} disabled={saving} style={{
                padding: "8px 20px", borderRadius: 8, background: "rgba(196,112,75,0.12)", color: "#C4704B",
                border: "1px solid rgba(196,112,75,0.35)", cursor: "pointer", fontSize: 13, fontWeight: 500,
              }}>
                {saving ? "Saving…" : `Save ${selected.size} to Dataset`}
              </button>
            )}
            {savedCount > 0 && selected.size === 0 && (
              <span style={{ fontSize: 13, color: "#22c55e" }}>✓ {savedCount} saved to dataset</span>
            )}
          </div>

          {/* Result cards */}
          {results.map((r, i) => {
            const isSelected = selected.has(i);
            const isOpen = expanded.has(i);
            return (
              <div key={i} style={{
                border: `1px solid ${isSelected ? "rgba(196,112,75,0.4)" : "rgba(196,112,75,0.12)"}`,
                borderRadius: 10, overflow: "hidden", background: isSelected ? "rgba(196,112,75,0.04)" : "rgba(255,255,255,0.02)",
                transition: "border-color 0.15s, background 0.15s",
              }}>
                {/* Row */}
                <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: 12, alignItems: "center" }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(i)}
                    style={{ width: 15, height: 15, accentColor: "#C4704B", cursor: "pointer" }} />
                  <div>
                    <p style={{ fontSize: 13, color: "#EDE6DD", margin: "0 0 3px" }}>{r.milestoneText.slice(0, 110)}{r.milestoneText.length > 110 ? "…" : ""}</p>
                    {r.sourceTitle && <span style={{ fontSize: 11, color: "#A89B8C" }}>↗ {r.sourceTitle}</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: DECISION_COLOR[r.decision] ?? "#A89B8C", whiteSpace: "nowrap" }}>
                    {r.decision}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: consensusColor(r.consensusLevel), whiteSpace: "nowrap" }}>
                    {r.consensusLevel}/{r.modelVotes.length || 5}
                  </span>
                  <button onClick={() => toggleExpand(i)} style={{ background: "none", border: "none", color: "#A89B8C", cursor: "pointer", fontSize: 11, padding: "0 4px" }}>
                    {isOpen ? "▲" : "▼"}
                  </button>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(196,112,75,0.12)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <p style={{ fontSize: 10, color: "#A89B8C", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 5px" }}>Milestone</p>
                      <p style={{ fontSize: 13, color: "#EDE6DD", lineHeight: 1.6, margin: 0 }}>{r.milestoneText}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "#A89B8C", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 5px" }}>Proof text</p>
                      <div style={{ maxHeight: 160, overflowY: "auto", background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#A89B8C", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {r.proofText.slice(0, 2000)}{r.proofText.length > 2000 ? "\n…" : ""}
                      </div>
                      {r.sourceUrl && (
                        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "#C4704B" }}>
                          View source ↗
                        </a>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "#A89B8C", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Model Votes</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {r.modelVotes.map(v => (
                          <div key={v.model} style={{ display: "grid", gridTemplateColumns: "100px 40px 50px 1fr", gap: 10, padding: "7px 10px", borderRadius: 7, background: "rgba(0,0,0,0.2)", alignItems: "start" }}>
                            <span style={{ fontSize: 12, color: "#EDE6DD", fontWeight: 500 }}>{v.model}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: DECISION_COLOR[v.decision] }}>{v.decision}</span>
                            <span style={{ fontSize: 11, color: "#A89B8C" }}>{v.confidence}%</span>
                            <span style={{ fontSize: 11, color: "#A89B8C", lineHeight: 1.5 }}>{v.reasoning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
