"use client";

import { useState } from "react";

interface Entry {
  id: string;
  period: string;
  aiVerdict: string;
  aiReasoning: string;
  xrplTxHash: string | null;
  certUrl: string | null;
  type: string;
  auditorEmail: string | null;
  createdAt: string;
}

interface Milestone {
  id: string;
  title: string;
  scheduleType: string | null;
  dataSourceType: string | null;
  dataSourceLockedAt: string | null;
}

interface Props {
  contractId: string;
  milestones: Milestone[];
  existingEntries: Record<string, Entry[]>;
  xrplExplorer: string;
}

const VERDICT_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  YES:          { color: "#059669", bg: "#ECFDF5", label: "Verified" },
  NO:           { color: "#DC2626", bg: "#FEF2F2", label: "Not Met" },
  INCONCLUSIVE: { color: "#D97706", bg: "#FFFBEB", label: "Inconclusive" },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = VERDICT_STYLE[verdict] ?? { color: "#64748B", bg: "#F8FAFC", label: verdict };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 10px",
      borderRadius: 20, fontSize: 11.5, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function EntryRow({ entry, xrplExplorer }: { entry: Entry; xrplExplorer: string }) {
  const [expanded, setExpanded] = useState(false);
  const isAuditor = entry.type === "AUDITOR_RERUN";
  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid var(--ent-border)",
      overflow: "hidden",
      background: isAuditor ? "#FAFFF7" : "white",
    }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <VerdictBadge verdict={entry.aiVerdict} />
        <span style={{ fontSize: 12.5, color: "var(--ent-muted)", fontFamily: "monospace", flex: 1 }}>
          {entry.period}
        </span>
        {isAuditor && (
          <span style={{
            fontSize: 10.5, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "#7C3AED", background: "#F5F3FF",
            padding: "2px 7px", borderRadius: 4,
          }}>
            Auditor Run
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--ent-muted)" }}>
          {new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
        <svg
          width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          style={{ color: "var(--ent-muted)", transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 14px", borderTop: "1px solid var(--ent-border)" }}>
          <p style={{ margin: "12px 0 8px", fontSize: 13, color: "var(--ent-text)", lineHeight: 1.6, fontStyle: "italic" }}>
            &ldquo;{entry.aiReasoning}&rdquo;
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {entry.certUrl && (
              <a href={entry.certUrl} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 12, fontWeight: 600, color: "var(--ent-accent)",
                textDecoration: "none", padding: "4px 10px",
                border: "1px solid var(--ent-border)", borderRadius: 5,
              }}>
                View Certificate ↗
              </a>
            )}
            {entry.xrplTxHash && (
              <a href={`${xrplExplorer}/transactions/${entry.xrplTxHash}`} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 12, fontWeight: 600, color: "var(--ent-muted)",
                textDecoration: "none", padding: "4px 10px",
                border: "1px solid var(--ent-border)", borderRadius: 5,
              }}>
                XRPL ↗
              </a>
            )}
          </div>
          {isAuditor && entry.auditorEmail && (
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--ent-muted)" }}>
              Run by auditor: {entry.auditorEmail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneAuditorBlock({
  contractId,
  milestone,
  entries,
  xrplExplorer,
}: {
  contractId: string;
  milestone: Milestone;
  entries: Entry[];
  xrplExplorer: string;
}) {
  const [email, setEmail] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ verdict?: string; reasoning?: string; certUrl?: string | null; xrplTxHash?: string | null; error?: string } | null>(null);
  const [localEntries, setLocalEntries] = useState<Entry[]>(entries);
  const [showHistory, setShowHistory] = useState(false);

  const latestPlatformEntry = localEntries.find((e) => e.type === "PLATFORM");
  const isLocked = !!milestone.dataSourceLockedAt;
  const isManual = milestone.dataSourceType === "MANUAL_REVIEW";

  async function handleRun() {
    if (!email.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/enterprise/share/${contractId}/auditor-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId: milestone.id, email: email.trim() }),
      });
      const data = await res.json() as {
        success?: boolean; entryId?: string; verdict?: string;
        reasoning?: string; certUrl?: string | null; xrplTxHash?: string | null; error?: string;
      };
      if (!res.ok || data.error) {
        setResult({ error: data.error ?? "Run failed" });
      } else {
        setResult({ verdict: data.verdict, reasoning: data.reasoning, certUrl: data.certUrl, xrplTxHash: data.xrplTxHash });
        const newEntry: Entry = {
          id: data.entryId ?? Date.now().toString(),
          period: new Date().toISOString().slice(0, 7),
          aiVerdict: data.verdict ?? "INCONCLUSIVE",
          aiReasoning: data.reasoning ?? "",
          xrplTxHash: data.xrplTxHash ?? null,
          certUrl: data.certUrl ?? null,
          type: "AUDITOR_RERUN",
          auditorEmail: email.trim(),
          createdAt: new Date().toISOString(),
        };
        setLocalEntries((prev) => [newEntry, ...prev]);
      }
    } catch {
      setResult({ error: "Network error — please try again." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{
      background: "white",
      border: "1px solid var(--ent-border)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 16,
    }}>
      {/* Milestone header */}
      <div style={{
        padding: "18px 20px",
        borderBottom: "1px solid var(--ent-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
            {milestone.title}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {latestPlatformEntry && <VerdictBadge verdict={latestPlatformEntry.aiVerdict} />}
            {milestone.scheduleType && (
              <span style={{ fontSize: 12, color: "var(--ent-muted)", fontFamily: "monospace" }}>
                {milestone.scheduleType}
              </span>
            )}
          </div>
        </div>
        {latestPlatformEntry && (
          <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
            Last run: {new Date(latestPlatformEntry.createdAt).toLocaleDateString("en-GB")}
          </span>
        )}
      </div>

      <div style={{ padding: "18px 20px" }}>
        {/* History */}
        {localEntries.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12.5, fontWeight: 600, color: "var(--ent-accent)",
                padding: 0, marginBottom: 10,
              }}
            >
              {showHistory ? "Hide" : "Show"} run history ({localEntries.length})
            </button>
            {showHistory && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {localEntries.map((e) => <EntryRow key={e.id} entry={e} xrplExplorer={xrplExplorer} />)}
              </div>
            )}
          </div>
        )}

        {/* Independent re-run form */}
        {!isLocked ? (
          <div style={{
            padding: "14px 16px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderRadius: 8,
            fontSize: 13,
            color: "#92400E",
          }}>
            This milestone&apos;s data source has not been locked yet — independent verification is not available.
          </div>
        ) : isManual ? (
          <div style={{
            padding: "14px 16px",
            background: "var(--ent-bg-alt)",
            border: "1px solid var(--ent-border)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--ent-muted)",
          }}>
            This milestone uses manual review — automated re-runs are not supported.
          </div>
        ) : (
          <div style={{ borderTop: localEntries.length > 0 ? "1px solid var(--ent-border)" : "none", paddingTop: localEntries.length > 0 ? 16 : 0 }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
              Run Independent Verification
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.55 }}>
              Enter your auditor email to trigger an independent AI verification. Your run will be recorded separately and anchored on the XRP Ledger.
            </p>

            {result && (
              <div style={{
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: 8,
                background: result.error ? "#FEF2F2" : result.verdict === "YES" ? "#ECFDF5" : result.verdict === "NO" ? "#FEF2F2" : "#FFFBEB",
                border: `1px solid ${result.error ? "#FECACA" : result.verdict === "YES" ? "#A7F3D0" : result.verdict === "NO" ? "#FECACA" : "#FDE68A"}`,
              }}>
                {result.error ? (
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#DC2626" }}>{result.error}</p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: VERDICT_STYLE[result.verdict ?? ""]?.color ?? "#64748B" }}>
                      Verdict: {VERDICT_STYLE[result.verdict ?? ""]?.label ?? result.verdict}
                    </p>
                    <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--ent-text)", fontStyle: "italic", lineHeight: 1.5 }}>
                      &ldquo;{result.reasoning}&rdquo;
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {result.certUrl && (
                        <a href={result.certUrl} target="_blank" rel="noopener noreferrer" style={{
                          fontSize: 12, fontWeight: 600, color: "var(--ent-accent)",
                          textDecoration: "none", padding: "4px 10px",
                          border: "1px solid var(--ent-border)", borderRadius: 5,
                        }}>
                          View Certificate ↗
                        </a>
                      )}
                      {result.xrplTxHash && (
                        <a href={`${xrplExplorer}/transactions/${result.xrplTxHash}`} target="_blank" rel="noopener noreferrer" style={{
                          fontSize: 12, fontWeight: 600, color: "var(--ent-muted)",
                          textDecoration: "none", padding: "4px 10px",
                          border: "1px solid var(--ent-border)", borderRadius: 5,
                        }}>
                          XRPL ↗
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{
                  flex: 1, minWidth: 200,
                  padding: "9px 12px",
                  border: "1px solid var(--ent-border)",
                  borderRadius: 7,
                  fontSize: 13,
                  color: "var(--ent-text)",
                  background: "white",
                  outline: "none",
                }}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRun(); }}
              />
              <button
                type="button"
                onClick={() => void handleRun()}
                disabled={!email.trim() || running}
                style={{
                  padding: "9px 18px",
                  background: running || !email.trim() ? "var(--ent-border)" : "var(--ent-accent)",
                  color: running || !email.trim() ? "var(--ent-muted)" : "white",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: running || !email.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {running ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.25" />
                      <path d="M21 12c0-4.97-4.03-9-9-9" />
                    </svg>
                    Running…
                  </>
                ) : (
                  "Run Verification"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function AuditorPanel({ contractId, milestones, existingEntries, xrplExplorer }: Props) {
  return (
    <div>
      {milestones.map((m) => (
        <MilestoneAuditorBlock
          key={m.id}
          contractId={contractId}
          milestone={m}
          entries={existingEntries[m.id] ?? []}
          xrplExplorer={xrplExplorer}
        />
      ))}
    </div>
  );
}
