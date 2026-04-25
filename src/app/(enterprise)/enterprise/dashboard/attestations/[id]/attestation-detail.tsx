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
  regulatoryTags: string[];
  latestEntries: EntryData[];
  internalApprovalStatus: string | null;
  internalApprovedBy: string | null;
  internalApprovedAt: string | null;
  internalApprovalNote: string | null;
  dataSourceConnector: string | null;
  connectorStatus: string | null;
  connectorLastHealthy: string | null;
}

interface GoalSet {
  id: string;
  title: string;
  requiresApproval: boolean;
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
  URL_SCRAPE:           "URL Scraping",
  REST_API:             "REST API",
  FILE_UPLOAD:          "File Upload",
  MANUAL_REVIEW:        "Manual Review",
  ENTERPRISE_CONNECTOR: "Enterprise Connector",
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

  // Enterprise connector fields
  const [connSystem,       setConnSystem]       = useState("SAP");
  const [connBaseUrl,      setConnBaseUrl]       = useState("");
  const [connAuthType,     setConnAuthType]     = useState("BASIC");
  const [connUsername,     setConnUsername]     = useState("");
  const [connPassword,     setConnPassword]     = useState("");
  const [connClientId,     setConnClientId]     = useState("");
  const [connClientSecret, setConnClientSecret] = useState("");
  const [connTokenUrl,     setConnTokenUrl]     = useState("");
  const [connEntity,       setConnEntity]       = useState("");
  const [connFilter,       setConnFilter]       = useState("");
  const [connTestResult,   setConnTestResult]   = useState<{ success: boolean; recordCount?: number; error?: string } | null>(null);

  const canTest = (srcType === "URL_SCRAPE" && url.trim()) ||
                  (srcType === "REST_API" && url.trim() && apiKey.trim());
  const canLock = srcType === "MANUAL_REVIEW" || srcType === "FILE_UPLOAD" || canTest ||
                  (srcType === "ENTERPRISE_CONNECTOR" && connBaseUrl.trim() && (
                    (connAuthType === "BASIC" && connUsername && connPassword) ||
                    (connAuthType !== "BASIC" && connClientId && connClientSecret)
                  ));

  async function handleConnectorTest() {
    setTesting(true);
    setConnTestResult(null);
    try {
      const res = await fetch(`/api/enterprise/attestations/${contractId}/milestones/${milestoneId}/connector`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: connSystem, baseUrl: connBaseUrl, authType: connAuthType,
          username: connUsername || undefined, password: connPassword || undefined,
          clientId: connClientId || undefined, clientSecret: connClientSecret || undefined,
          tokenUrl: connTokenUrl || undefined, entity: connEntity || undefined,
          filter: connFilter || undefined, testOnly: true,
        }),
      });
      const data = await res.json() as { success: boolean; recordCount?: number; error?: string };
      setConnTestResult(data);
      if (data.success) toast.success(`Connection OK — ${data.recordCount ?? "?"} records`);
      else toast.error(data.error ?? "Connection failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleConnectorLock() {
    setLocking(true);
    try {
      const res = await fetch(`/api/enterprise/attestations/${contractId}/milestones/${milestoneId}/connector`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: connSystem, baseUrl: connBaseUrl, authType: connAuthType,
          username: connUsername || undefined, password: connPassword || undefined,
          clientId: connClientId || undefined, clientSecret: connClientSecret || undefined,
          tokenUrl: connTokenUrl || undefined, entity: connEntity || undefined,
          filter: connFilter || undefined, scheduleType: schedule, testOnly: false,
        }),
      });
      const data = await res.json() as { success: boolean; error?: string; recordCount?: number };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Save failed");
      toast.success("Enterprise connector configured");
      onLocked("REST_API", connBaseUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLocking(false);
    }
  }

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
        {(["URL_SCRAPE", "REST_API", "FILE_UPLOAD", "MANUAL_REVIEW", "ENTERPRISE_CONNECTOR"] as const).map((t) => (
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

      {/* Enterprise Connector form */}
      {srcType === "ENTERPRISE_CONNECTOR" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>System</label>
              <select value={connSystem} onChange={(e) => setConnSystem(e.target.value)} style={{ ...inputCss(), width: "100%" }}>
                <option value="SAP">SAP</option>
                <option value="WORKDAY">Workday</option>
                <option value="SALESFORCE">Salesforce</option>
                <option value="NETSUITE">NetSuite</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Base URL</label>
              <input type="url" placeholder="https://your-instance.example.com" value={connBaseUrl} onChange={(e) => setConnBaseUrl(e.target.value)} style={inputCss()} />
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Authentication</label>
            <select value={connAuthType} onChange={(e) => setConnAuthType(e.target.value)} style={{ ...inputCss(), width: "100%" }}>
              <option value="BASIC">Basic (username + password)</option>
              <option value="OAUTH2_CLIENT">OAuth 2.0 Client Credentials</option>
              <option value="OAUTH1">OAuth 1.0</option>
            </select>
          </div>
          {connAuthType === "BASIC" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Username</label>
                <input type="text" placeholder="user@company.com" value={connUsername} onChange={(e) => setConnUsername(e.target.value)} style={inputCss()} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Password</label>
                <input type="password" value={connPassword} onChange={(e) => setConnPassword(e.target.value)} style={inputCss()} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Client ID</label>
                  <input type="text" value={connClientId} onChange={(e) => setConnClientId(e.target.value)} style={inputCss()} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Client Secret</label>
                  <input type="password" value={connClientSecret} onChange={(e) => setConnClientSecret(e.target.value)} style={inputCss()} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Token URL</label>
                <input type="url" placeholder="https://auth.example.com/token" value={connTokenUrl} onChange={(e) => setConnTokenUrl(e.target.value)} style={inputCss()} />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
                Entity / Object <span style={{ fontWeight: 400, fontSize: 11 }}>(e.g. CostCenter, Employee)</span>
              </label>
              <input type="text" placeholder="CostCenter" value={connEntity} onChange={(e) => setConnEntity(e.target.value)} style={inputCss()} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>
                Filter <span style={{ fontWeight: 400, fontSize: 11 }}>(optional OData / SOQL)</span>
              </label>
              <input type="text" placeholder="Year eq '2026'" value={connFilter} onChange={(e) => setConnFilter(e.target.value)} style={inputCss()} />
            </div>
          </div>
          {connTestResult && (
            <div style={{
              padding: "10px 14px", borderRadius: 6, fontSize: 12.5,
              background: connTestResult.success ? "#F0FDF4" : "#FEF2F2",
              border: `1px solid ${connTestResult.success ? "#BBF7D0" : "#FECACA"}`,
              color: connTestResult.success ? "#166534" : "#991B1B",
            }}>
              {connTestResult.success
                ? `✓ Connected — ${connTestResult.recordCount ?? "?"} records fetched`
                : `✗ ${connTestResult.error ?? "Connection failed"}`}
            </div>
          )}
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
        {srcType === "ENTERPRISE_CONNECTOR" ? (
          <>
            <button
              type="button" disabled={testing || !connBaseUrl} onClick={handleConnectorTest}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: (testing || !connBaseUrl) ? "not-allowed" : "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-text)" }}
            >
              {testing ? "Testing…" : "Test Connection"}
            </button>
            <button
              type="button" disabled={locking || !canLock} onClick={handleConnectorLock}
              style={{ padding: "7px 16px", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: (locking || !canLock) ? "not-allowed" : "pointer", border: "none", background: canLock ? "var(--ent-accent)" : "#E5E7EB", color: canLock ? "white" : "#9CA3AF" }}
            >
              {locking ? "Saving…" : "Save & Lock Connector"}
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
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
  requiresApproval: boolean;
  userRole: string;
  onUpdate: (id: string, updates: Partial<MilestoneData>) => void;
}

function MilestoneCard({ milestone, goalSetId, requiresApproval, userRole, onUpdate }: CardProps) {
  const [configuring,   setConfiguring]   = useState(false);
  const [running,       setRunning]       = useState(false);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [fileReady,     setFileReady]     = useState(!!milestone.attestationFetchedAt);
  const [approving,     setApproving]     = useState(false);
  const [rejectNote,    setRejectNote]    = useState("");
  const [showReject,    setShowReject]    = useState(false);

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

  async function handleApprovalAction(action: "APPROVED" | "REJECTED") {
    setApproving(true);
    try {
      const res = await fetch(
        `/api/enterprise/attestations/${goalSetId}/milestones/${milestone.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note: action === "REJECTED" ? rejectNote : undefined }),
        }
      );
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      onUpdate(milestone.id, {
        internalApprovalStatus: action,
        internalApprovalNote: action === "REJECTED" ? rejectNote : null,
      });
      setShowReject(false);
      setRejectNote("");
      toast.success(action === "APPROVED" ? "Milestone approved for verification" : "Milestone rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setApproving(false);
    }
  }

  const verdictCfg = latestEntry
    ? VERDICT_CFG[latestEntry.aiVerdict as keyof typeof VERDICT_CFG] ?? null
    : null;

  const canRunFileUpload = milestone.dataSourceType === "FILE_UPLOAD" && fileReady;
  const isApproved = !requiresApproval || milestone.internalApprovalStatus === "APPROVED";
  const canRun = isLocked &&
    milestone.dataSourceType !== "MANUAL_REVIEW" &&
    !running &&
    isApproved &&
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
        <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.55 }}>
          {milestone.description}
        </p>
      )}

      <RegulatoryTagSelector
        milestoneId={milestone.id}
        contractId={goalSetId}
        initialTags={milestone.regulatoryTags}
        onSaved={(tags) => onUpdate(milestone.id, { regulatoryTags: tags })}
      />

      <div style={{ marginBottom: 14 }} />

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
          {milestone.dataSourceConnector && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              color: milestone.connectorStatus === "OK" ? "#16A34A" : milestone.connectorStatus === "ERROR" ? "#DC2626" : "#6B7280",
              background: milestone.connectorStatus === "OK" ? "#DCFCE7" : milestone.connectorStatus === "ERROR" ? "#FEE2E2" : "#F3F4F6",
              flexShrink: 0,
            }}>
              {milestone.dataSourceConnector} · {milestone.connectorStatus ?? "UNKNOWN"}
              {milestone.connectorLastHealthy && milestone.connectorStatus === "OK" && (
                <> · {new Date(milestone.connectorLastHealthy).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>
              )}
            </span>
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

      {/* Approval workflow banner */}
      {requiresApproval && isLocked && milestone.dataSourceType !== "MANUAL_REVIEW" && (
        <div style={{ marginBottom: 14 }}>
          {milestone.internalApprovalStatus === "APPROVED" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, fontSize: 13 }}>
              <svg width="14" height="14" fill="none" stroke="#059669" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              <span style={{ color: "#059669", fontWeight: 600 }}>Approved</span>
              <span style={{ color: "#6B7280" }}>by {milestone.internalApprovedBy}</span>
            </div>
          )}
          {milestone.internalApprovalStatus === "REJECTED" && (
            <div style={{ padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: milestone.internalApprovalNote ? 4 : 0 }}>
                <svg width="14" height="14" fill="none" stroke="#DC2626" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                <span style={{ color: "#DC2626", fontWeight: 600 }}>Rejected</span>
                <span style={{ color: "#6B7280" }}>by {milestone.internalApprovedBy}</span>
                {userRole !== "VIEWER" && (
                  <button type="button" onClick={() => void handleApprovalAction("APPROVED")} disabled={approving}
                    style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", border: "none", background: "#059669", color: "white" }}>
                    Override & Approve
                  </button>
                )}
              </div>
              {milestone.internalApprovalNote && (
                <p style={{ margin: 0, fontSize: 12, color: "#DC2626", opacity: 0.8 }}>{milestone.internalApprovalNote}</p>
              )}
            </div>
          )}
          {!milestone.internalApprovalStatus && userRole !== "VIEWER" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" fill="none" stroke="#D97706" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Awaiting internal approval before verification can run</span>
              </div>
              {!showReject ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => void handleApprovalAction("APPROVED")} disabled={approving}
                    style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", border: "none", background: "#059669", color: "white" }}>
                    {approving ? "Approving…" : "Approve"}
                  </button>
                  <button type="button" onClick={() => setShowReject(true)} disabled={approving}
                    style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", border: "1px solid #FECACA", background: "white", color: "#DC2626" }}>
                    Reject
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    rows={2}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #FECACA", borderRadius: 6, fontSize: 12.5, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => void handleApprovalAction("REJECTED")} disabled={approving}
                      style={{ padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: approving ? "not-allowed" : "pointer", border: "none", background: "#DC2626", color: "white" }}>
                      {approving ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button type="button" onClick={() => { setShowReject(false); setRejectNote(""); }}
                      style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12.5, cursor: "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-muted)" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!milestone.internalApprovalStatus && userRole === "VIEWER" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 13, color: "#92400E" }}>
              <svg width="14" height="14" fill="none" stroke="#D97706" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Awaiting approval from an admin or editor
            </div>
          )}
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
            title={
              !canRun && requiresApproval && milestone.internalApprovalStatus !== "APPROVED"
                ? "Approve this milestone before running verification"
                : !canRun && milestone.dataSourceType === "FILE_UPLOAD"
                  ? "Upload a source file first"
                  : undefined
            }
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

// ── Regulatory tag selector ───────────────────────────────────────────────────

const TAG_GROUPS: { label: string; color: string; bg: string; tags: { id: string; label: string }[] }[] = [
  {
    label: "CSRD / ESRS", color: "#059669", bg: "#ECFDF5",
    tags: [
      { id: "CSRD:E1", label: "E1 Climate change" },
      { id: "CSRD:E2", label: "E2 Pollution" },
      { id: "CSRD:E3", label: "E3 Water" },
      { id: "CSRD:E4", label: "E4 Biodiversity" },
      { id: "CSRD:E5", label: "E5 Circular economy" },
      { id: "CSRD:S1", label: "S1 Own workforce" },
      { id: "CSRD:S2", label: "S2 Value chain workers" },
      { id: "CSRD:S3", label: "S3 Affected communities" },
      { id: "CSRD:S4", label: "S4 Consumers" },
      { id: "CSRD:G1", label: "G1 Business conduct" },
    ],
  },
  {
    label: "UN SDGs", color: "#2563EB", bg: "#EFF6FF",
    tags: [
      { id: "SDG:7", label: "SDG 7 Clean energy" },
      { id: "SDG:8", label: "SDG 8 Decent work" },
      { id: "SDG:9", label: "SDG 9 Industry" },
      { id: "SDG:10", label: "SDG 10 Inequalities" },
      { id: "SDG:12", label: "SDG 12 Responsible consumption" },
      { id: "SDG:13", label: "SDG 13 Climate action" },
      { id: "SDG:16", label: "SDG 16 Institutions" },
    ],
  },
  {
    label: "GRI", color: "#7C3AED", bg: "#F5F3FF",
    tags: [
      { id: "GRI:302", label: "GRI 302 Energy" },
      { id: "GRI:305", label: "GRI 305 Emissions" },
      { id: "GRI:401", label: "GRI 401 Employment" },
      { id: "GRI:403", label: "GRI 403 OHS" },
      { id: "GRI:405", label: "GRI 405 Diversity" },
    ],
  },
  {
    label: "TCFD", color: "#D97706", bg: "#FFFBEB",
    tags: [
      { id: "TCFD:GOVERNANCE", label: "Governance" },
      { id: "TCFD:STRATEGY",   label: "Strategy" },
      { id: "TCFD:RISK",       label: "Risk management" },
      { id: "TCFD:METRICS",    label: "Metrics & targets" },
    ],
  },
];

function RegulatoryTagSelector({
  milestoneId,
  contractId,
  initialTags,
  onSaved,
}: {
  milestoneId: string;
  contractId: string;
  initialTags: string[];
  onSaved: (tags: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTags));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/milestones/${milestoneId}/regulatory-tags`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tags: [...selected] }) }
      );
      const data = await res.json() as { tags?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.tags ?? [...selected]);
      toast.success("Regulatory tags saved");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const savedTags = initialTags;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            background: "none", border: "1px solid var(--ent-border)",
            borderRadius: 6, padding: "4px 10px", fontSize: 12,
            fontWeight: 500, color: "var(--ent-muted)", cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
          </svg>
          Regulatory tags
          {savedTags.length > 0 && (
            <span style={{
              minWidth: 16, height: 16, borderRadius: "50%",
              background: "var(--ent-accent)", color: "white",
              fontSize: 10, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {savedTags.length}
            </span>
          )}
        </button>

        {!open && savedTags.map((t) => {
          const group = TAG_GROUPS.find((g) => g.tags.some((tag) => tag.id === t));
          const tag = group?.tags.find((tag) => tag.id === t);
          return tag ? (
            <span key={t} style={{
              fontSize: 11, fontWeight: 600,
              color: group?.color ?? "#64748B",
              background: group?.bg ?? "#F8FAFC",
              padding: "2px 7px", borderRadius: 4,
            }}>
              {t}
            </span>
          ) : null;
        })}
      </div>

      {open && (
        <div style={{
          marginTop: 10,
          border: "1px solid var(--ent-border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "white",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ent-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ent-text)" }}>
              Map to regulatory frameworks
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ent-muted)", padding: 2 }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {TAG_GROUPS.map((group) => (
              <div key={group.label}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: group.color }}>
                  {group.label}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {group.tags.map((tag) => {
                    const isOn = selected.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggle(tag.id)}
                        style={{
                          padding: "4px 10px", borderRadius: 5, fontSize: 12, fontWeight: 500,
                          cursor: "pointer", border: `1px solid ${isOn ? group.color : "var(--ent-border)"}`,
                          background: isOn ? group.bg : "white",
                          color: isOn ? group.color : "var(--ent-muted)",
                          transition: "all 0.1s",
                        }}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--ent-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-muted)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{ padding: "7px 16px", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", border: "none", background: saving ? "#93C5FD" : "var(--ent-accent)", color: "white" }}
            >
              {saving ? "Saving…" : "Save tags"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export function AttestationDetail({
  goalSet,
  milestones: initialMilestones,
  userRole = "OWNER",
}: {
  goalSet: GoalSet;
  milestones: MilestoneData[];
  userRole?: string;
}) {
  const [milestones, setMilestones] = useState<MilestoneData[]>(initialMilestones);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(goalSet.requiresApproval);
  const [togglingApproval, setTogglingApproval] = useState(false);
  const [boardPackPeriod, setBoardPackPeriod] = useState("");
  const [boardPackOpen, setBoardPackOpen] = useState(false);
  const [boardPackLoading, setBoardPackLoading] = useState(false);
  const [transparencyPeriod, setTransparencyPeriod] = useState(() => {
    const now = new Date();
    return `Q${Math.ceil((now.getMonth() + 1) / 3)}-${now.getFullYear()}`;
  });
  const [transparencyOpen, setTransparencyOpen] = useState(false);
  const [transparencyLoading, setTransparencyLoading] = useState(false);

  async function handleToggleApproval() {
    setTogglingApproval(true);
    const next = !requiresApproval;
    try {
      const res = await fetch(`/api/enterprise/attestations/${goalSet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresApproval: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setRequiresApproval(next);
      toast.success(next ? "Approval workflow enabled" : "Approval workflow disabled");
    } catch {
      toast.error("Failed to update approval setting");
    } finally {
      setTogglingApproval(false);
    }
  }

  const handleUpdate = useCallback((id: string, updates: Partial<MilestoneData>) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const runnableCount = milestones.filter(
    (m) => m.dataSourceLockedAt && m.dataSourceType !== "MANUAL_REVIEW" &&
      (!requiresApproval || m.internalApprovalStatus === "APPROVED")
  ).length;
  const pendingApprovalCount = requiresApproval
    ? milestones.filter((m) => m.dataSourceLockedAt && m.dataSourceType !== "MANUAL_REVIEW" && !m.internalApprovalStatus).length
    : 0;

  async function handleBoardPack() {
    const period = boardPackPeriod.trim();
    if (!period) { toast.error("Please enter a period (e.g. 2026-Q1)"); return; }
    setBoardPackLoading(true);
    try {
      const res = await fetch("/api/reports/board-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: goalSet.id, period }),
      });
      const data = await res.json() as { blobUrl?: string; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Failed to generate report"); return; }
      toast.success("Board pack generated");
      window.open(data.blobUrl, "_blank");
      setBoardPackOpen(false);
      setBoardPackPeriod("");
    } catch {
      toast.error("Network error");
    } finally {
      setBoardPackLoading(false);
    }
  }

  async function handleTransparencyReport() {
    const period = transparencyPeriod.trim();
    if (!period) { toast.error("Enter a report period (e.g. Q2-2026)"); return; }
    setTransparencyLoading(true);
    try {
      const res = await fetch(`/api/enterprise/attestations/${goalSet.id}/transparency-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate report");
      window.open(data.url, "_blank");
      toast.success("Transparency report generated");
      setTransparencyOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setTransparencyLoading(false);
    }
  }

  async function handleBulkRun() {
    if (!runnableCount || bulkRunning) return;
    setBulkRunning(true);
    try {
      const res = await fetch(`/api/enterprise/attestations/${goalSet.id}/bulk-run`, {
        method: "POST",
      });
      const data = await res.json() as {
        ran?: number;
        results?: { milestoneId: string; title: string; verdict?: string; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Bulk run failed");
        return;
      }
      const results = data.results ?? [];
      const succeeded = results.filter((r) => r.verdict).length;
      const failed = results.filter((r) => r.error).length;
      toast.success(`Bulk run complete — ${succeeded} ran${failed ? `, ${failed} skipped` : ""}`);
      // Refresh page data by reloading (simplest for server component parent)
      window.location.reload();
    } catch {
      toast.error("Network error during bulk run");
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      {/* Board Pack modal */}
      {boardPackOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setBoardPackOpen(false)}
        >
          <div
            style={{
              background: "white", borderRadius: 12, padding: 28,
              width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Generate Board Pack
            </h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
              Enter a period to include in the report. Examples: <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>2026-Q1</code>, <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>2026</code>, <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>2026-04</code>
            </p>
            <input
              type="text"
              placeholder="e.g. 2026-Q1"
              value={boardPackPeriod}
              onChange={(e) => setBoardPackPeriod(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleBoardPack(); }}
              autoFocus
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 7,
                border: "1px solid #D1D5DB", fontSize: 14,
                outline: "none", marginBottom: 16,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setBoardPackOpen(false)}
                style={{
                  padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  border: "1px solid #D1D5DB", background: "white", color: "#374151",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBoardPack()}
                disabled={boardPackLoading || !boardPackPeriod.trim()}
                style={{
                  padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  border: "none",
                  background: boardPackLoading || !boardPackPeriod.trim() ? "#E5E7EB" : "#C4704B",
                  color: boardPackLoading || !boardPackPeriod.trim() ? "#9CA3AF" : "white",
                  cursor: boardPackLoading || !boardPackPeriod.trim() ? "not-allowed" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {boardPackLoading ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
                      <path d="M21 12c0-4.97-4.03-9-9-9" />
                    </svg>
                    Generating…
                  </>
                ) : "Generate Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transparency Report modal */}
      {transparencyOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setTransparencyOpen(false)}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#111827" }}>Stakeholder Transparency Report</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
              Generates a public-facing HTML report with verified goals, evidence summaries, XRPL proof links, and regulatory coverage — suitable for investors, regulators, or annual reports.
            </p>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Report Period</label>
            <input
              type="text"
              placeholder="Q2-2026"
              value={transparencyPeriod}
              onChange={(e) => setTransparencyPeriod(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 16, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setTransparencyOpen(false)} style={{ padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "1px solid #D1D5DB", background: "white", color: "#374151", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={transparencyLoading}
                onClick={() => void handleTransparencyReport()}
                style={{ padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", background: "var(--ent-accent)", color: "white", cursor: transparencyLoading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {transparencyLoading ? "Generating…" : "Generate & Open"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval workflow toggle + pending notice */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {userRole !== "VIEWER" && (
          <button
            type="button"
            onClick={() => void handleToggleApproval()}
            disabled={togglingApproval}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
              cursor: togglingApproval ? "not-allowed" : "pointer",
              border: `1px solid ${requiresApproval ? "#A7F3D0" : "var(--ent-border)"}`,
              background: requiresApproval ? "#ECFDF5" : "white",
              color: requiresApproval ? "#059669" : "var(--ent-muted)",
            }}
            title={requiresApproval ? "Disable approval workflow" : "Enable approval workflow — milestones must be approved before AI verification runs"}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            {requiresApproval ? "Approval required" : "Approval workflow off"}
          </button>
        )}
        {pendingApprovalCount > 0 && (
          <span style={{ fontSize: 12.5, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "5px 12px", fontWeight: 500 }}>
            {pendingApprovalCount} milestone{pendingApprovalCount !== 1 ? "s" : ""} awaiting approval
          </span>
        )}
        <a
          href={`/enterprise/dashboard/attestations/${goalSet.id}/consensus`}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            border: "1px solid var(--ent-border)",
            background: "white", color: "var(--ent-muted)",
            textDecoration: "none",
          }}
          title="Manage consensus voting — invite auditors, regulators, and investors to verify milestones"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
          Consensus
        </a>
        <button
          type="button"
          onClick={() => setBoardPackOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            border: "1px solid var(--ent-border)",
            background: "white", color: "var(--ent-muted)",
            cursor: "pointer",
          }}
          title="Generate a board-ready HTML report with AI executive summary"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Board Pack
        </button>
        <button
          type="button"
          onClick={() => setTransparencyOpen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            border: "1px solid var(--ent-border)",
            background: "white", color: "var(--ent-muted)",
            cursor: "pointer",
          }}
          title="Generate a public-facing stakeholder transparency report"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          Transparency Report
        </button>
      </div>

      {runnableCount > 1 && (
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={bulkRunning}
            onClick={() => void handleBulkRun()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "8px 18px", borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: bulkRunning ? "not-allowed" : "pointer",
              border: "none",
              background: bulkRunning ? "#E5E7EB" : "var(--ent-accent)",
              color: bulkRunning ? "#9CA3AF" : "white",
            }}
          >
            {bulkRunning ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  style={{ animation: "spin 1s linear infinite" }}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
                  <path d="M21 12c0-4.97-4.03-9-9-9" />
                </svg>
                Running all…
              </>
            ) : (
              <>
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run All ({runnableCount})
              </>
            )}
          </button>
        </div>
      )}

      {milestones.map((m) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          goalSetId={goalSet.id}
          requiresApproval={requiresApproval}
          userRole={userRole}
          onUpdate={handleUpdate}
        />
      ))}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
