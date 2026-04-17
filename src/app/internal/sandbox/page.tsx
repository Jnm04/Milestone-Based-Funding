"use client";

import { useRef, useState } from "react";
import { internalFetch } from "@/lib/internal-client";

interface ModelVote { model: string; decision: "YES" | "NO"; confidence: number; reasoning: string }
interface SandboxResult {
  decision: "YES" | "NO";
  reasoning: string;
  confidence: number;
  modelVotes: ModelVote[];
  consensusLevel: number;
  extractedText?: string;
  extractedTextPreview?: string;
}

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.pptx,.xlsx,.csv,.txt";

export default function SandboxPage() {
  const [milestoneText, setMilestoneText] = useState("");
  const [proofText, setProofText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setSaved(false);
    setError("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function run() {
    if (!milestoneText.trim() || (!file && !proofText.trim())) return;
    setRunning(true);
    setResult(null);
    setError("");
    setSaved(false);

    let res: Response;
    if (file) {
      const fd = new FormData();
      fd.append("milestoneText", milestoneText);
      fd.append("proofText", proofText);
      fd.append("saveToDataset", "false");
      fd.append("file", file);
      res = await internalFetch("/api/internal/sandbox", {
        method: "POST",
        body: fd,
      }, key());
    } else {
      res = await internalFetch("/api/internal/sandbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ milestoneText, proofText, saveToDataset: false }),
      }, key());
    }

    if (!res.ok) { setError("Failed — check API keys or file format"); setRunning(false); return; }
    setResult(await res.json());
    setRunning(false);
  }

  async function saveToDataset() {
    if (!result) return;
    setSaving(true);

    // Send the already-computed result back — no re-verification, no vote drift.
    await internalFetch("/api/internal/sandbox", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        milestoneText,
        proofText: result.extractedText ?? proofText,
        saveToDataset: true,
        precomputedVotes: result.modelVotes,
        precomputedConsensusLevel: result.consensusLevel,
        precomputedDecision: result.decision,
        precomputedExtractedText: result.extractedText ?? proofText,
      }),
    });

    setSaving(false);
    setSaved(true);
  }

  const canRun = milestoneText.trim() && (file || proofText.trim());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Sandbox</h1>
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Test milestone/proof pairs without contracts or escrow. Upload a file or paste text manually.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Milestone */}
        <div>
          <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Milestone criteria</label>
          <textarea value={milestoneText} onChange={(e) => setMilestoneText(e.target.value)}
            placeholder="e.g. Launch a working MVP with at least 10 real user signups and a deployed live URL…"
            rows={3} style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(196,112,75,0.2)", background: "rgba(255,255,255,0.03)", color: "#EDE6DD", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>

        {/* File upload */}
        <div>
          <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Proof file <span style={{ color: "rgba(168,155,140,0.5)", textTransform: "none", letterSpacing: 0 }}>— PDF, image, Word, Excel, CSV, …</span>
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%", padding: "20px 14px", borderRadius: 10, boxSizing: "border-box",
              border: `1px dashed ${dragging ? "rgba(196,112,75,0.6)" : file ? "rgba(34,197,94,0.4)" : "rgba(196,112,75,0.25)"}`,
              background: dragging ? "rgba(196,112,75,0.06)" : "rgba(255,255,255,0.02)",
              cursor: "pointer", textAlign: "center", transition: "all 0.15s",
            }}
          >
            {file ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>📎</span>
                <span style={{ color: "#EDE6DD", fontSize: 14 }}>{file.name}</span>
                <span style={{ color: "#A89B8C", fontSize: 12 }}>({(file.size / 1024).toFixed(0)} KB)</span>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} style={{
                  background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px",
                }}>×</button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 24, marginBottom: 6 }}>↑</div>
                <div style={{ color: "#A89B8C", fontSize: 13 }}>Drop file here or click to browse</div>
                <div style={{ color: "rgba(168,155,140,0.5)", fontSize: 11, marginTop: 4 }}>PDF · PNG · JPG · WEBP · DOCX · XLSX · CSV · TXT</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        {/* Proof text — optional when file is selected */}
        <div>
          <label style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
            Proof text {file ? <span style={{ color: "rgba(168,155,140,0.5)", textTransform: "none", letterSpacing: 0 }}>— optional (file takes priority)</span> : <span style={{ color: "rgba(168,155,140,0.5)", textTransform: "none", letterSpacing: 0 }}>— or paste manually</span>}
          </label>
          <textarea value={proofText} onChange={(e) => setProofText(e.target.value)}
            placeholder={file ? "Optional: add extra context not in the file…" : "Paste the extracted text from a proof document, or write a synthetic example…"}
            rows={file ? 3 : 8} style={{
              width: "100%", padding: "12px 14px", borderRadius: 10, boxSizing: "border-box",
              border: "1px solid rgba(196,112,75,0.2)", background: "rgba(255,255,255,0.03)",
              color: "#EDE6DD", fontSize: 14, resize: "vertical", fontFamily: "inherit",
              opacity: file ? 0.6 : 1,
            }} />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={run} disabled={running || !canRun} style={{
            padding: "12px 24px", borderRadius: 8, background: "#C4704B", color: "#fff", border: "none",
            cursor: canRun && !running ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 500, opacity: running || !canRun ? 0.6 : 1,
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
                <span style={{ fontSize: 13, color: "#A89B8C" }}>Consensus: <strong style={{ color: "#EDE6DD" }}>{result.consensusLevel}/{result.modelVotes.length || 5}</strong></span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#C8BEB4", lineHeight: 1.6, margin: 0 }}>{result.reasoning}</p>
          </div>

          {/* Extracted text preview */}
          {result.extractedTextPreview && result.extractedTextPreview !== proofText.slice(0, 600) && (
            <div style={{ padding: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Extracted text preview</div>
              <pre style={{ fontSize: 12, color: "#C8BEB4", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 120, overflow: "auto" }}>
                {result.extractedTextPreview}{result.extractedTextPreview.length >= 600 ? "\n…" : ""}
              </pre>
            </div>
          )}

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
