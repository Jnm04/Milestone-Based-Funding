"use client";

import { useState, useCallback } from "react";
import type { ModelVote } from "@/components/ai-result";

interface AuthenticityFlag {
  type: string;
  severity: "WARNING" | "RED_FLAG";
  detail: string;
}

interface MilestoneProof {
  id: string;
  fileName: string;
  fileUrl: string;
  fileHash?: string | null;
  aiDecision: string | null;
  aiReasoning: string | null;
  aiConfidence: number | null;
  aiModelVotes?: ModelVote[] | null;
  authenticityFlags?: AuthenticityFlag[] | null;
  authenticityScore?: number | null;
  aiContentSummary?: string | null;
  aiResubmissionDiff?: string | null;
  createdAt: string;
}

const MODEL_SHORT: Record<string, string> = {
  "Claude": "Claude", "Claude Haiku": "Claude",
  "Gemini": "Gemini", "Gemini Flash": "Gemini",
  "OpenAI": "GPT-4o-mini", "GPT-4o-mini": "GPT-4o-mini",
  "Mistral": "Mistral", "Mistral Small": "Mistral",
  "Cerebras/Qwen3": "Cerebras",
};
function shortName(m: string) { return MODEL_SHORT[m] ?? m.split(/[\s/]/)[0]; }

interface MilestoneItem {
  id: string;
  title: string;
  amountUSD: string;
  cancelAfter: string;
  status: string;
  order: number;
  escrowSequence: number | null;
  proofs: MilestoneProof[];
  reputationSummary?: string | null;
  reputationPublic?: boolean;
  reputationCategory?: string | null;
}

interface MilestoneTimelineProps {
  milestones: MilestoneItem[];
  activeMilestoneId: string | null;
  /** "startup" = show reputation opt-in toggle on completed milestones */
  viewerRole?: "investor" | "startup" | null;
  contractId?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:         { bg: "rgba(168,155,140,0.12)", text: "#A89B8C",  border: "rgba(168,155,140,0.25)" },
  AWAITING_ESCROW: { bg: "rgba(196,112,75,0.15)",  text: "#E8935A",  border: "rgba(196,112,75,0.35)"  },
  FUNDED:          { bg: "rgba(96,165,250,0.12)",  text: "#7DB8F7",  border: "rgba(96,165,250,0.3)"   },
  PROOF_SUBMITTED: { bg: "rgba(167,139,250,0.12)", text: "#C4ADFA",  border: "rgba(167,139,250,0.3)"  },
  PENDING_REVIEW:  { bg: "rgba(196,112,75,0.15)",  text: "#E8935A",  border: "rgba(196,112,75,0.35)"  },
  VERIFIED:        { bg: "rgba(74,222,128,0.12)",  text: "#6EE09A",  border: "rgba(74,222,128,0.3)"   },
  REJECTED:        { bg: "rgba(248,113,113,0.12)", text: "#F87171",  border: "rgba(248,113,113,0.3)"  },
  RENEGOTIATING:   { bg: "rgba(212,160,60,0.12)",  text: "#D4A03C",  border: "rgba(212,160,60,0.3)"   },
  EXPIRED:         { bg: "rgba(168,155,140,0.12)", text: "#A89B8C",  border: "rgba(168,155,140,0.25)" },
  COMPLETED:       { bg: "rgba(74,222,128,0.12)",  text: "#6EE09A",  border: "rgba(74,222,128,0.3)"   },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:         "Pending",
  AWAITING_ESCROW: "Awaiting Escrow",
  FUNDED:          "Funded",
  PROOF_SUBMITTED: "Proof Submitted",
  PENDING_REVIEW:  "Manual Review",
  VERIFIED:        "Verified",
  REJECTED:        "Rejected",
  RENEGOTIATING:   "Renegotiating",
  EXPIRED:         "Expired",
  COMPLETED:       "Completed",
};

export function MilestoneTimeline({ milestones, activeMilestoneId, viewerRole, contractId }: MilestoneTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Track reputation public state locally so toggle is instant
  const [reputationPublicMap, setReputationPublicMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(milestones.map((ms) => [ms.id, ms.reputationPublic ?? false]))
  );
  const [reputationToggling, setReputationToggling] = useState<string | null>(null);

  const handleReputationToggle = useCallback(async (milestoneId: string, newValue: boolean) => {
    if (!contractId) return;
    setReputationToggling(milestoneId);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/milestones/${milestoneId}/reputation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public: newValue }),
        }
      );
      if (res.ok) {
        setReputationPublicMap((prev) => ({ ...prev, [milestoneId]: newValue }));
      }
    } finally {
      setReputationToggling(null);
    }
  }, [contractId]);

  if (milestones.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Milestones</h2>
      <div className="flex flex-col gap-2">
        {milestones.map((ms, idx) => {
          const isActive = activeMilestoneId === ms.id;
          const isCompleted = ms.status === "COMPLETED";
          const isPending = ms.status === "PENDING";
          const isExpanded = expandedId === ms.id;
          const colors = STATUS_COLORS[ms.status] ?? STATUS_COLORS.PENDING;
          const isRepPublic = reputationPublicMap[ms.id] ?? false;

          return (
            <div key={ms.id}>
              {/* Milestone row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : ms.id)}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px 16px",
                  background: isActive
                    ? "rgba(196,112,75,0.08)"
                    : isCompleted
                    ? "rgba(74,222,128,0.05)"
                    : "rgba(255,255,255,0.03)",
                  border: isExpanded
                    ? "1.5px solid rgba(196,112,75,0.5)"
                    : isActive
                    ? "1.5px solid rgba(196,112,75,0.4)"
                    : isCompleted
                    ? "1px solid rgba(74,222,128,0.25)"
                    : "1px solid rgba(196,112,75,0.15)",
                  borderRadius: isExpanded ? "12px 12px 0 0" : "12px",
                  opacity: isPending ? 0.6 : 1,
                  transition: "border-color 0.15s",
                  userSelect: "none",
                }}
              >
                {/* Number / check badge */}
                <div
                  style={{
                    flexShrink: 0,
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isCompleted ? "#16a34a" : isActive ? "#C4704B" : "rgba(168,155,140,0.2)",
                    color: isCompleted || isActive ? "#fff" : "#A89B8C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#EDE6DD" }}>
                      {ms.title}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {STATUS_LABELS[ms.status] ?? ms.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "12px", color: "#A89B8C", flexWrap: "wrap", alignItems: "center" }}>
                    {Number(ms.amountUSD) <= 1 ? (
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            background: ["VERIFIED", "COMPLETED"].includes(ms.status)
                              ? "hsl(22 55% 54% / 0.15)"
                              : "hsl(28 18% 14% / 0.8)",
                            border: `1px solid ${["VERIFIED", "COMPLETED"].includes(ms.status) ? "hsl(22 55% 54% / 0.4)" : "hsl(28 18% 18%)"}`,
                            color: ["VERIFIED", "COMPLETED"].includes(ms.status) ? "hsl(22 55% 64%)" : "hsl(30 10% 55%)",
                            borderRadius: "6px",
                            padding: "1px 7px",
                            fontSize: "11px",
                            fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {["VERIFIED", "COMPLETED"].includes(ms.status) ? "✓ $0.10 charged" : "Verification · $0.10"}
                        </span>
                      </span>
                    ) : (
                      <span>
                        <strong style={{ color: "#D4B896" }}>${Number(ms.amountUSD).toLocaleString()}</strong>{" "}RLUSD
                      </span>
                    )}
                    <span>
                      Due:{" "}
                      <strong style={{ color: "#D4B896" }}>
                        {new Date(ms.cancelAfter).toLocaleDateString()}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Expand indicator */}
                <span style={{ fontSize: "11px", color: "#A89B8C", marginTop: "6px", flexShrink: 0 }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1.5px solid rgba(196,112,75,0.5)",
                    borderTop: "none",
                    borderRadius: "0 0 12px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* Escrow info */}
                  {ms.escrowSequence && (
                    <div style={{ fontSize: "12px", color: "#A89B8C" }}>
                      <span style={{ fontWeight: 600, color: "#EDE6DD" }}>Escrow Sequence:</span>{" "}
                      <code style={{ fontFamily: "monospace" }}>{ms.escrowSequence}</code>
                    </div>
                  )}

                  {/* Proofs */}
                  {ms.proofs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "#C4704B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {ms.proofs.length > 1 ? `Submission History (${ms.proofs.length})` : "Proof Submitted"}
                      </p>
                      {ms.proofs.map((proof, idx) => (
                        <div
                          key={proof.id}
                          style={{
                            padding: "10px 12px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(196,112,75,0.15)",
                            borderRadius: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {ms.proofs.length > 1 && (
                              <span style={{ fontSize: "10px", fontWeight: 700, color: idx === 0 ? "#86efac" : "#A89B8C", background: idx === 0 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>
                                #{ms.proofs.length - idx}
                              </span>
                            )}
                            <span style={{ fontSize: "11px", fontFamily: "monospace", background: "rgba(196,112,75,0.15)", padding: "2px 6px", borderRadius: "4px", color: "#C4704B" }}>
                              {proof.fileName.split(".").pop()?.toUpperCase() ?? "FILE"}
                            </span>
                            <a
                              href={proof.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: "13px", color: "#7DB8F7", textDecoration: "underline", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {proof.fileName}
                            </a>
                            {proof.aiDecision && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: "999px",
                                  background: proof.aiDecision === "YES" ? "rgba(74,222,128,0.12)" : proof.aiDecision === "NO" ? "rgba(248,113,113,0.12)" : "rgba(196,112,75,0.15)",
                                  color: proof.aiDecision === "YES" ? "#6EE09A" : proof.aiDecision === "NO" ? "#F87171" : "#E8935A",
                                }}
                              >
                                AI: {proof.aiDecision === "YES" ? "Approved" : proof.aiDecision === "NO" ? "Rejected" : "Review"}
                                {proof.aiConfidence !== null ? ` (${proof.aiConfidence}%)` : ""}
                              </span>
                            )}
                          </div>
                          {/* Feature V: Proof Contents TL;DR — investor only */}
                          {viewerRole === "investor" && proof.aiContentSummary && (() => {
                            let items: string[] = [];
                            try { items = JSON.parse(proof.aiContentSummary) as string[]; } catch { /* skip */ }
                            if (!Array.isArray(items) || items.length === 0) return null;
                            return (
                              <div
                                style={{
                                  marginTop: "4px",
                                  padding: "8px 10px",
                                  background: "rgba(196,112,75,0.06)",
                                  border: "1px solid rgba(196,112,75,0.18)",
                                  borderRadius: "6px",
                                }}
                              >
                                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4704B" }}>
                                  Proof Contents
                                </span>
                                <ul style={{ margin: "5px 0 0 0", padding: "0 0 0 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
                                  {items.map((item, i) => (
                                    <li key={i} style={{ fontSize: "11px", color: "#D4B896", lineHeight: 1.4 }}>
                                      {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}
                          {/* Feature W: Resubmission Diff — startup only */}
                          {viewerRole === "startup" && proof.aiResubmissionDiff && (() => {
                            let diff: { addressed?: string[]; stillOpen?: string[] } = {};
                            try { diff = JSON.parse(proof.aiResubmissionDiff) as typeof diff; } catch { /* skip */ }
                            const hasAddressed = Array.isArray(diff.addressed) && diff.addressed.length > 0;
                            const hasStillOpen = Array.isArray(diff.stillOpen) && diff.stillOpen.length > 0;
                            if (!hasAddressed && !hasStillOpen) return null;
                            return (
                              <div
                                style={{
                                  marginTop: "4px",
                                  padding: "10px 12px",
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(196,112,75,0.2)",
                                  borderRadius: "6px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "8px",
                                }}
                              >
                                <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#C4704B" }}>
                                  Resubmission Analysis
                                </span>
                                {hasAddressed && (
                                  <div>
                                    <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6EE09A" }}>
                                      Addressed
                                    </span>
                                    <ul style={{ margin: "4px 0 0 0", padding: "0 0 0 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
                                      {diff.addressed!.map((item, i) => (
                                        <li key={i} style={{ fontSize: "11px", color: "#A8D4B4", lineHeight: 1.4 }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {hasStillOpen && (
                                  <div>
                                    <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F87171" }}>
                                      Still Open
                                    </span>
                                    <ul style={{ margin: "4px 0 0 0", padding: "0 0 0 14px", display: "flex", flexDirection: "column", gap: "3px" }}>
                                      {diff.stillOpen!.map((item, i) => (
                                        <li key={i} style={{ fontSize: "11px", color: "#F4A5A5", lineHeight: 1.4 }}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* Per-model vote grid */}
                          {proof.aiModelVotes && proof.aiModelVotes.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", marginTop: "2px" }}>
                              {proof.aiModelVotes.map((vote) => {
                                const vYes = vote.decision === "YES";
                                return (
                                  <div
                                    key={vote.model}
                                    title={`${vote.model}: ${vote.decision} (${vote.confidence}%)`}
                                    style={{
                                      padding: "4px 2px",
                                      borderRadius: "6px",
                                      background: vYes ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                                      border: `1px solid ${vYes ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "center",
                                      gap: "2px",
                                    }}
                                  >
                                    <span style={{ fontSize: "9px", fontWeight: 700, color: vYes ? "#6EE09A" : "#F87171" }}>
                                      {vYes ? "YES" : "NO"}
                                    </span>
                                    <span style={{ fontSize: "8px", color: "#A89B8C", textAlign: "center", lineHeight: 1.1 }}>
                                      {shortName(vote.model)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {proof.aiReasoning && (
                            <p style={{ fontSize: "12px", color: "#A89B8C", lineHeight: 1.5, margin: 0 }}>
                              {proof.aiReasoning}
                            </p>
                          )}
                          {proof.fileHash && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "10px", color: "#6B5E52" }}>SHA-256</span>
                              <code
                                title={proof.fileHash}
                                style={{ fontSize: "10px", fontFamily: "monospace", color: "#A89B8C" }}
                              >
                                {proof.fileHash.slice(0, 16)}…{proof.fileHash.slice(-8)}
                              </code>
                            </div>
                          )}
                          {/* Authenticity flags (shown when pre-screen found issues) */}
                          {proof.authenticityFlags && proof.authenticityFlags.length > 0 && (
                            <div
                              style={{
                                marginTop: "2px",
                                padding: "8px 10px",
                                background: "rgba(248,113,113,0.06)",
                                border: "1px solid rgba(248,113,113,0.2)",
                                borderRadius: "6px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", color: "#F87171", textTransform: "uppercase" }}>
                                  Authenticity Screen
                                </span>
                                {proof.authenticityScore !== null && proof.authenticityScore !== undefined && (
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: proof.authenticityScore >= 70 ? "rgba(74,222,128,0.1)" : proof.authenticityScore >= 40 ? "rgba(212,160,60,0.1)" : "rgba(248,113,113,0.1)",
                                    color: proof.authenticityScore >= 70 ? "#6EE09A" : proof.authenticityScore >= 40 ? "#D4A03C" : "#F87171",
                                  }}>
                                    {proof.authenticityScore}/100
                                  </span>
                                )}
                              </div>
                              {proof.authenticityFlags.map((flag, fi) => (
                                <div key={fi} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                                  <span style={{
                                    flexShrink: 0,
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "1px 5px",
                                    borderRadius: "4px",
                                    background: flag.severity === "RED_FLAG" ? "rgba(248,113,113,0.15)" : "rgba(212,160,60,0.12)",
                                    color: flag.severity === "RED_FLAG" ? "#F87171" : "#D4A03C",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}>
                                    {flag.severity === "RED_FLAG" ? "Red Flag" : "Warning"}
                                  </span>
                                  <span style={{ fontSize: "11px", color: "#EDE6DD", lineHeight: 1.4 }}>
                                    {flag.detail}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p style={{ fontSize: "11px", color: "#6B5E52", margin: 0 }}>
                            {new Date(proof.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#6B5E52" }}>No proofs submitted yet for this milestone.</p>
                  )}

                  {/* Feature L: Completion report download — shown to both parties on completed milestones */}
                  {isCompleted && contractId && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "10px 12px",
                        background: "rgba(74,222,128,0.05)",
                        border: "1px solid rgba(74,222,128,0.2)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#6EE09A" }}>
                          Completion Report
                        </span>
                        <p style={{ fontSize: "11px", color: "#A89B8C", margin: 0 }}>
                          AI-verified proof-of-delivery document
                        </p>
                      </div>
                      <a
                        href={`/api/contracts/${contractId}/milestones/${ms.id}/completion-report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flexShrink: 0,
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "4px 12px",
                          borderRadius: "6px",
                          border: "1px solid rgba(74,222,128,0.3)",
                          background: "rgba(74,222,128,0.1)",
                          color: "#6EE09A",
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        View Report
                      </a>
                    </div>
                  )}

                  {/* Feature H: Reputation opt-in for startup on completed milestones */}
                  {isCompleted && viewerRole === "startup" && ms.reputationSummary && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "10px 12px",
                        background: isRepPublic ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)",
                        border: isRepPublic ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(196,112,75,0.15)",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "12px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: isRepPublic ? "#6EE09A" : "#C4704B" }}>
                          Reputation Card
                        </span>
                        <p style={{ fontSize: "11px", color: "#A89B8C", margin: 0, lineHeight: 1.4, maxWidth: "260px" }}>
                          {isRepPublic
                            ? "This achievement is visible on your public profile."
                            : "Share this achievement on your public profile."}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={reputationToggling === ms.id}
                        onClick={(e) => { e.stopPropagation(); void handleReputationToggle(ms.id, !isRepPublic); }}
                        style={{
                          flexShrink: 0,
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: isRepPublic ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(196,112,75,0.3)",
                          background: isRepPublic ? "rgba(74,222,128,0.1)" : "rgba(196,112,75,0.12)",
                          color: isRepPublic ? "#6EE09A" : "#E8935A",
                          cursor: reputationToggling === ms.id ? "not-allowed" : "pointer",
                          opacity: reputationToggling === ms.id ? 0.5 : 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {reputationToggling === ms.id ? "…" : isRepPublic ? "Make Private" : "Make Public"}
                      </button>
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
