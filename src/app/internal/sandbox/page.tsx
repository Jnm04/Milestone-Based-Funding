"use client";

import { useState } from "react";

interface ModelVote { model: string; decision: "YES" | "NO"; confidence: number; reasoning: string }
interface SandboxResult {
  decision: "YES" | "NO";
  reasoning: string;
  confidence: number;
  modelVotes: ModelVote[];
  consensusLevel: number;
}

export default function SandboxPage() {
  const [milestoneText, setMilestoneText] = useState("");
  const [proofText, setProofText] = useState("");
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  async function run() {
    if (!milestoneText.trim() || !proofText.trim()) return;
    setRunning(true);
    setResult(null);
    setError("");
    setSaved(false);
    const res = await fetch("/api/internal/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key() },
      body: JSON.stringify({ milestoneText, proofText, saveToDataset: false }),
    });
    if (!res.ok) { setError("Failed — check API keys"); setRunning(false); return; }
    setResult(await res.json());
    setRunning(false);
  }

  async function saveToDataset() {
    if (!milestoneText.trim() || !proofText.trim()) return;
    setSaving(true);
    await fetch("/api/internal/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": key() },
      body: JSON.stringify({ milestoneText, proofText, saveToDataset: true }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Sandbox</h1>
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Test milestone/proof pairs without contracts or escrow. Results are stored in the brain dataset.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Milestone criteria</label>
          <textarea value={milestoneText} onChange={(e) => setMilestoneText(e.target.value)}
            placeholder="e.g. Launch a working MVP with at least 10 real user signups and a deployed live URL…"
            rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(196,112,75,0.2)", background: "rgba(255,255,255,0.03)", color: "#EDE6DD", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>

        <div>
          <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Proof content (paste PDF text or write manually)</label>
          <textarea value={proofText} onChange={(e) => setProofText(e.target.value)}
            placeholder="Paste the extracted text from a proof document, or write a synthetic example…"
            rows={8} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(196,112,75,0.2)", background: "rgba(255,255,255,0.03)", color: "#EDE6DD", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={run} disabled={running || !milestoneText.trim() || !proofText.trim()} style={{
            padding: "12px 24px", borderRadius: 8, background: "#C4704B", color: "#fff", border: "none",
            cursor: "pointer", fontSize: 14, fontWeight: 500, opacity: running ? 0.6 : 1,
          }}>
            {running ? "Running 5 models…" : "Run Verification"}
          </button>
          {result && !saved && (
            <button onClick={saveToDataset} disabled={saving} style={{
              padding: "12px 24px", borderRadius: 8, background: "rgba(196,112,75,0.1)", color: "#C4704B",
              border: "1px solid rgba(196,112,75,0.3)", cursor: "pointer", fontSize: 14,
            }}>
              {saving ? "Saving…" : "Save to Dataset"}
            </button>
          )}
          {saved && <span style={{ padding: "12px 0", fontSize: 13, color: "#22c55e" }}>✓ Saved to dataset</span>}
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Combined verdict */}
          <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${result.decision === "YES" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: result.decision === "YES" ? "#22c55e" : "#ef4444" }}>
                {result.decision === "YES" ? "✓ APPROVED" : "✗ REJECTED"}
              </span>
              <div style={{ display: "flex", gap: 12 }}>
                <span style={{ fontSize: 13, color: "#A89B8C" }}>Confidence: <strong style={{ color: "#EDE6DD" }}>{result.confidence}%</strong></span>
                <span style={{ fontSize: 13, color: "#A89B8C" }}>Consensus: <strong style={{ color: "#EDE6DD" }}>{result.consensusLevel}/5</strong></span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#C8BEB4", lineHeight: 1.6, margin: 0 }}>{result.reasoning}</p>
          </div>

          {/* Individual votes */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {result.modelVotes.map((v) => (
              <div key={v.model} style={{ padding: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${v.decision === "YES" ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#A89B8C" }}>{v.model}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: v.decision === "YES" ? "#22c55e" : "#ef4444" }}>{v.decision} · {v.confidence}%</span>
                </div>
                <p style={{ fontSize: 12, color: "#C8BEB4", margin: 0, lineHeight: 1.5 }}>{v.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
