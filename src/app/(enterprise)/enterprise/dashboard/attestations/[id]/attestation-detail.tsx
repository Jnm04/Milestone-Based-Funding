"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EntryData {
  id: string;
  period: string;
  aiVerdict: string;
  aiReasoning: string | null;
  xrplTxHash: string | null;
  certUrl: string | null;
  type: string;
  createdAt: string;
}

interface MilestoneData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cancelAfter: string;
  order: number;
  dataSourceType: string | null;
  dataSourceUrl: string | null;
  dataSourceApiKeyHint: string | null;
  dataSourceLockedAt: string | null;
  scheduleType: string | null;
  attestationCertUrl: string | null;
  attestationFetchedAt: string | null;
  latestEntries: EntryData[];
}

interface GoalSet {
  id: string;
  title: string;
}

// ── Config maps ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  FUNDED:          { label: "Ready",        color: "#2563EB", bg: "#EFF6FF" },
  PROOF_SUBMITTED: { label: "Under Review", color: "#D97706", bg: "#FFFBEB" },
  VERIFIED:        { label: "Verified",     color: "#059669", bg: "#ECFDF5" },
  COMPLETED:       { label: "Completed",    color: "#059669", bg: "#ECFDF5" },
  REJECTED:        { label: "Rejected",     color: "#DC2626", bg: "#FEF2F2" },
  PENDING_REVIEW:  { label: "Inconclusive", color: "#D97706", bg: "#FFFBEB" },
  PENDING:         { label: "Pending",      color: "#64748B", bg: "#F8FAFC" },
};

const VERDICT_CFG = {
  YES:          { label: "Verified",     icon: "✓", color: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  NO:           { label: "Not Verified", icon: "✗", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  INCONCLUSIVE: { label: "Inconclusive", icon: "~", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
} as const;

const SRC_LABEL: Record<string, string> = {
  URL_SCRAPE:    "URL Scraping",
  REST_API:      "REST API",
  FILE_UPLOAD:   "File Upload",
  MANUAL_REVIEW: "Manual Review",
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: "#64748B", bg: "#F8FAFC" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 20,
      fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function Pulse() {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%",
      background: "#2563EB", display: "inline-block",
      animation: "pulse-dot 1.4s ease-in-out infinite",
      flexShrink: 0,
    }} />
  );
}

function inputCss(): React.CSSProperties {
  return {
    width: "100%", padding: "8px 10px",
    border: "1px solid var(--ent-border)", borderRadius: 6,
    fontSize: 13, color: "var(--ent-text)", background: "white",
    boxSizing: "border-box",
  };
}

// ── Data-source config form ───────────────────────────────────────────────────

interface ConfigPanelProps {
  milestoneId: string;
  contractId: string;
  onLocked: (sourceType: string, sourceUrl: string | null) => void;
}

function DataSourceConfigPanel({ milestoneId, contractId, onLocked }: ConfigPanelProps) {
  const [srcType,      setSrcType]      = useState("URL_SCRAPE");
  const [url,          setUrl]          = useState("");
  const [apiKey,       setApiKey]       = useState("");
  const [method,       setMethod]       = useState("GET");
  const [responsePath, setResponsePath] = useState("");
  const [schedule,     setSchedule]     = useState("ONE_OFF");
  const [testing,      setTesting]      = useState(false);
  const [testPreview,  setTestPreview]  = useState<{ preview: string; statusCode: number } | null>(null);
  const [locking,      setLocking]      = useState(false);

  const canTest = (srcType === "URL_SCRAPE" && url.trim()) ||
                  (srcType === "REST_API" && url.trim() && apiKey.trim());
  const canLock = srcType === "MANUAL_REVIEW" || srcType === "FILE_UPLOAD" || canTest;

  async function handleTest() {
    setTesting(true);
    setTestPreview(null);
    try {
      const res = await fetch("/api/attestation/test-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataSourceType: srcType,
          dataSourceUrl: url,
          apiKey: apiKey || undefined,
          dataSourceConfig: { method, responsePath: responsePath || undefined },
        }),
      });
      const data = await res.json() as { preview?: string; statusCode?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Test failed");
      setTestPreview({ preview: data.preview ?? "", statusCode: data.statusCode ?? 0 });
      toast.success(`Source responded — HTTP ${data.statusCode}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleLock() {
    setLocking(true);
    try {
      const body: Record<string, unknown> = { dataSourceType: srcType, scheduleType: schedule };
      if (srcType === "URL_SCRAPE") body.dataSourceUrl = url;
      if (srcType === "REST_API") {
        body.dataSourceUrl = url;
        body.apiKey = apiKey;
        body.dataSourceConfig = { method, responsePath: responsePath || undefined };
      }
      const res = await fetch(
        `/api/contracts/${contractId}/milestones/${milestoneId}/attestation/lock-source`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Lock failed");
      toast.success("Data source locked");
      onLocked(srcType, url || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lock failed");
    } finally {
      setLocking(false);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
    cursor: "pointer", border: "1px solid",
    borderColor: active ? "var(--ent-accent)" : "var(--ent-border)",
    background: active ? "var(--ent-accent)" : "white",
    color: active ? "white" : "var(--ent-muted)",
  });

  return (
    <div style={{ marginTop: 16, padding: 16, background: "#F8FAFC", border: "1px solid var(--ent-border)", borderRadius: 8 }}>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, fontWeight: 700, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Configure Data Source
      </p>

      {/* Source type tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {(["URL_SCRAPE", "REST_API", "FILE_UPLOAD", "MANUAL_REVIEW"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setSrcType(t)} style={tabStyle(srcType === t)}>
            {SRC_LABEL[t]}
          </button>
        ))}
      </div>

      {/* URL field */}
      {(srcType === "URL_SCRAPE" || srcType === "REST_API") && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
            {srcType === "URL_SCRAPE" ? "URL to Monitor" : "API Endpoint URL"}
          </label>
          <input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} style={inputCss()} />
        </div>
      )}

      {/* REST-API extras */}
      {srcType === "REST_API" && (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
              API Key (sent as Bearer token)
            </label>
            <input type="password" placeholder="sk-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} style={inputCss()} />
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inputCss(), width: "100%" }}>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
                JSON Path <span style={{ fontWeight: 400, fontSize: 11 }}>(optional — e.g. data.revenue)</span>
              </label>
              <input type="text" placeholder="data.revenue" value={responsePath} onChange={(e) => setResponsePath(e.target.value)} style={inputCss()} />
            </div>
          </div>
        </>
      )}

      {/* Info panels */}
      {srcType === "FILE_UPLOAD" && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 12.5, color: "#1E40AF" }}>
          After locking, upload a document each time you want AI to evaluate it.
        </div>
      )}
      {srcType === "MANUAL_REVIEW" && (
        <div style={{ marginBottom: 12, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, fontSize: 12.5, color: "#92400E" }}>
          Verdicts are set manually by an auditor. The automated runner will skip this milestone.
        </div>
      )}

      {/* Schedule */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
          Attestation Schedule
        </label>
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={{ ...inputCss(), width: "100%" }}>
          <option value="ONE_OFF">One-off (manual trigger only)</option>
          <option value="MONTHLY">Monthly — runs on the 1st of each month</option>
          <option value="QUARTERLY">Quarterly — runs at the start of each quarter</option>
          <option value="ANNUAL">Annual — runs on 1 January each year</option>
        </select>
      </div>

      {/* Test preview */}
      {testPreview && (
        <div style={{ marginBottom: 12, padding: "10px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 700, color: "#166534" }}>HTTP {testPreview.statusCode} — Content preview</p>
          <pre style={{ margin: 0, fontSize: 11, color: "#14532D", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 100, overflow: "hidden", fontFamily: "monospace" }}>
            {testPreview.preview.slice(0, 500)}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        {canTest && (
          <button
            type="button" disabled={testing} onClick={handleTest}
            style={{ padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: testing ? "not-allowed" : "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-text)" }}
          >
            {testing ? "Testing…" : "Test Source"}
          </button>
        )}
        <button
          type="button" disabled={locking || !canLock} onClick={handleLock}
          style={{ padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: (locking || !canLock) ? "not-allowed" : "pointer", border: "none", background: canLock ? "var(--ent-accent)" : "#E5E7EB", color: canLock ? "white" : "#9CA3AF" }}
        >
          {locking ? "Locking…" : "Lock Data Source"}
        </button>
      </div>
    </div>
  );
}

// ── File upload for FILE_UPLOAD source ────────────────────────────────────────

interface FileUploadProps {
  milestoneId: string;
  contractId: string;
  onUploaded: () => void;
}

function FileUploadButton({ milestoneId, contractId, onUploaded }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/contracts/${contractId}/milestones/${milestoneId}/attestation/upload-source`,
        { method: "POST", body: fd }
      );
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success("Source file uploaded");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={ref} type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
      <button
        type="button" disabled={uploading} onClick={() => ref.current?.click()}
        style={{ padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-text)", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        {uploading ? "Uploading…" : "Upload Source File"}
      </button>
    </>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ entries }: { entries: EntryData[] }) {
  if (entries.length === 0) return null;
  const th: React.CSSProperties = {
    textAlign: "left", padding: "6px 8px",
    fontSize: 11, fontWeight: 700, color: "var(--ent-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em",
    borderBottom: "1px solid var(--ent-border)",
  };
  const td: React.CSSProperties = {
    padding: "8px 8px", borderBottom: "1px solid var(--ent-border)",
    fontSize: 12.5, color: "var(--ent-text)",
  };
  return (
    <div style={{ marginTop: 12, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Period", "Verdict", "Type", "Certificate", "XRPL", "Date"].map((h) => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const v = VERDICT_CFG[e.aiVerdict as keyof typeof VERDICT_CFG];
            return (
              <tr key={e.id}>
                <td style={{ ...td, fontFamily: "monospace", fontSize: 11.5 }}>{e.period}</td>
                <td style={td}>
                  {v
                    ? <span style={{ fontWeight: 700, color: v.color }}>{v.icon} {v.label}</span>
                    : <span style={{ color: "var(--ent-muted)" }}>{e.aiVerdict}</span>}
                </td>
                <td style={{ ...td, color: "var(--ent-muted)" }}>
                  {e.type === "AUDITOR_RERUN" ? "Auditor" : "Platform"}
                </td>
                <td style={td}>
                  {e.certUrl
                    ? <a href={e.certUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ent-accent)", textDecoration: "none" }}>View ↗</a>
                    : <span style={{ color: "var(--ent-muted)" }}>—</span>}
                </td>
                <td style={td}>
                  {e.xrplTxHash
                    ? <a href={`https://xrpscan.com/tx/${e.xrplTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ent-accent)", textDecoration: "none" }}>XRPL ↗</a>
                    : <span style={{ color: "var(--ent-muted)" }}>—</span>}
                </td>
                <td style={{ ...td, color: "var(--ent-muted)", whiteSpace: "nowrap" }}>
                  {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────

interface CardProps {
  milestone: MilestoneData;
  goalSetId: string;
  onUpdate: (id: string, updates: Partial<MilestoneData>) => void;
}

function MilestoneCard({ milestone, goalSetId, onUpdate }: CardProps) {
  const [configuring,   setConfiguring]   = useState(false);
  const [running,       setRunning]       = useState(false);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [fileReady,     setFileReady]     = useState(!!milestone.attestationFetchedAt);

  const isLocked     = !!milestone.dataSourceLockedAt;
  const entries      = milestone.latestEntries;
  const latestEntry  = entries[0] ?? null;
  const deadline     = new Date(milestone.cancelAfter);
  const daysLeft     = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch(
        `/api/contracts/${goalSetId}/milestones/${milestone.id}/attestation/run`,
        { method: "POST" }
      );
      const data = await res.json() as {
        entryId?: string; verdict?: string; reasoning?: string;
        xrplTxHash?: string | null; certUrl?: string | null; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Run failed");

      const now = new Date().toISOString();
      const period = now.slice(0, 10);
      const newEntry: EntryData = {
        id: data.entryId ?? now,
        period,
        aiVerdict: data.verdict ?? "INCONCLUSIVE",
        aiReasoning: data.reasoning ?? null,
        xrplTxHash: data.xrplTxHash ?? null,
        certUrl: data.certUrl ?? null,
        type: "PLATFORM",
        createdAt: now,
      };

      const verdict = data.verdict ?? "INCONCLUSIVE";
      onUpdate(milestone.id, {
        latestEntries: [newEntry, ...entries],
        status: verdict === "YES" ? "VERIFIED" : verdict === "NO" ? "REJECTED" : "PENDING_REVIEW",
        attestationCertUrl: data.certUrl ?? null,
      });
      toast.success(`Attestation complete — ${verdict}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attestation run failed");
    } finally {
      setRunning(false);
    }
  }

  const verdictCfg = latestEntry
    ? VERDICT_CFG[latestEntry.aiVerdict as keyof typeof VERDICT_CFG] ?? null
    : null;

  const canRunFileUpload = milestone.dataSourceType === "FILE_UPLOAD" && fileReady;
  const canRun = isLocked &&
    milestone.dataSourceType !== "MANUAL_REVIEW" &&
    !running &&
    (milestone.dataSourceType !== "FILE_UPLOAD" || canRunFileUpload);

  return (
    <div style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 12, padding: 24, marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: milestone.description ? 10 : 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              #{milestone.order}
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>{milestone.title}</h3>
            <StatusBadge status={milestone.status} />
          </div>
        </div>
        <div style={{ fontSize: 12.5, whiteSpace: "nowrap", fontWeight: daysLeft <= 7 ? 600 : 400, color: daysLeft < 0 ? "#DC2626" : daysLeft <= 7 ? "#D97706" : "var(--ent-muted)" }}>
          {daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due today" : `Due ${deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        </div>
      </div>

      {milestone.description && (
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.55 }}>
          {milestone.description}
        </p>
      )}

      {/* Source info bar */}
      {isLocked && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "8px 12px", background: "#F8FAFC", border: "1px solid var(--ent-border)", borderRadius: 6, fontSize: 12.5 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ent-muted)", flexShrink: 0 }}>Source</span>
          <span style={{ fontWeight: 600, color: "var(--ent-text)", flexShrink: 0 }}>
            {SRC_LABEL[milestone.dataSourceType ?? ""] ?? milestone.dataSourceType}
          </span>
          {milestone.dataSourceUrl && (
            <span style={{ color: "var(--ent-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
              {milestone.dataSourceUrl}
            </span>
          )}
          {milestone.dataSourceApiKeyHint && (
            <span style={{ color: "var(--ent-muted)", flexShrink: 0 }}>key …{milestone.dataSourceApiKeyHint}</span>
          )}
          {milestone.scheduleType && milestone.scheduleType !== "ONE_OFF" && (
            <span style={{ marginLeft: "auto", color: "var(--ent-muted)", flexShrink: 0 }}>
              {milestone.scheduleType.charAt(0) + milestone.scheduleType.slice(1).toLowerCase()}
            </span>
          )}
        </div>
      )}

      {/* Latest verdict */}
      {latestEntry && verdictCfg && (
        <div style={{ padding: "14px 16px", background: verdictCfg.bg, border: `1px solid ${verdictCfg.border}`, borderRadius: 8, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: latestEntry.aiReasoning ? 8 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: verdictCfg.color }}>
                {verdictCfg.icon} {verdictCfg.label}
              </span>
              <span style={{ fontSize: 12, color: verdictCfg.color, opacity: 0.75, fontFamily: "monospace" }}>
                {latestEntry.period}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {latestEntry.certUrl && (
                <a
                  href={latestEntry.certUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: verdictCfg.color, textDecoration: "none", padding: "3px 10px", border: `1px solid ${verdictCfg.border}`, borderRadius: 5 }}
                >
                  Certificate ↗
                </a>
              )}
              {latestEntry.xrplTxHash && (
                <a
                  href={`https://xrpscan.com/tx/${latestEntry.xrplTxHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, fontWeight: 600, color: verdictCfg.color, textDecoration: "none", padding: "3px 10px", border: `1px solid ${verdictCfg.border}`, borderRadius: 5 }}
                >
                  XRPL ↗
                </a>
              )}
            </div>
          </div>
          {latestEntry.aiReasoning && (
            <p style={{ margin: 0, fontSize: 13, color: verdictCfg.color, lineHeight: 1.5, opacity: 0.85 }}>
              {latestEntry.aiReasoning.length > 400
                ? latestEntry.aiReasoning.slice(0, 400) + "…"
                : latestEntry.aiReasoning}
            </p>
          )}
        </div>
      )}

      {/* Running state */}
      {running && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, marginBottom: 14, fontSize: 13.5, color: "#1D4ED8", fontWeight: 500 }}>
          <Pulse />
          Attestation in progress — AI is evaluating the evidence…
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Configure button (only when not locked) */}
        {!isLocked && (
          <button
            type="button" onClick={() => setConfiguring((v) => !v)}
            style={{ padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid var(--ent-accent)", background: configuring ? "var(--ent-accent)" : "white", color: configuring ? "white" : "var(--ent-accent)" }}
          >
            {configuring ? "Cancel" : "+ Configure Data Source"}
          </button>
        )}

        {/* FILE_UPLOAD: upload button */}
        {isLocked && milestone.dataSourceType === "FILE_UPLOAD" && !running && (
          <FileUploadButton
            milestoneId={milestone.id}
            contractId={goalSetId}
            onUploaded={() => setFileReady(true)}
          />
        )}

        {/* Run button */}
        {isLocked && milestone.dataSourceType !== "MANUAL_REVIEW" && !running && (
          <button
            type="button" disabled={!canRun} onClick={handleRun}
            title={!canRun && milestone.dataSourceType === "FILE_UPLOAD" ? "Upload a source file first" : undefined}
            style={{ padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: canRun ? "pointer" : "not-allowed", border: "none", background: canRun ? "var(--ent-accent)" : "#E5E7EB", color: canRun ? "white" : "#9CA3AF", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {latestEntry ? "Run Again" : "Run Attestation"}
          </button>
        )}

        {/* Manual review notice */}
        {isLocked && milestone.dataSourceType === "MANUAL_REVIEW" && !latestEntry && (
          <span style={{ fontSize: 13, color: "var(--ent-muted)", fontStyle: "italic" }}>
            Awaiting manual review by auditor
          </span>
        )}

        {/* History toggle */}
        {entries.length > 0 && (
          <button
            type="button" onClick={() => setHistoryOpen((v) => !v)}
            style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-muted)" }}
          >
            {historyOpen ? "Hide history" : `History (${entries.length})`}
          </button>
        )}
      </div>

      {/* Inline config form */}
      {configuring && (
        <DataSourceConfigPanel
          milestoneId={milestone.id}
          contractId={goalSetId}
          onLocked={(srcType, srcUrl) => {
            setConfiguring(false);
            onUpdate(milestone.id, {
              dataSourceType: srcType,
              dataSourceUrl: srcUrl,
              dataSourceLockedAt: new Date().toISOString(),
            });
          }}
        />
      )}

      {/* History table */}
      {historyOpen && <HistoryPanel entries={entries} />}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export function AttestationDetail({
  goalSet,
  milestones: initialMilestones,
}: {
  goalSet: GoalSet;
  milestones: MilestoneData[];
}) {
  const [milestones, setMilestones] = useState<MilestoneData[]>(initialMilestones);

  const handleUpdate = useCallback((id: string, updates: Partial<MilestoneData>) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
      {milestones.map((m) => (
        <MilestoneCard key={m.id} milestone={m} goalSetId={goalSet.id} onUpdate={handleUpdate} />
      ))}
    </>
  );
}
