"use client";

import { useState } from "react";

interface MilestoneProof {
  id: string;
  fileName: string;
  fileUrl: string;
  aiDecision: string | null;
  aiReasoning: string | null;
  aiConfidence: number | null;
  createdAt: string;
}

interface MilestoneItem {
  id: string;
  title: string;
  amountUSD: string;
  cancelAfter: string;
  status: string;
  order: number;
  escrowSequence: number | null;
  proofs: MilestoneProof[];
}

interface MilestoneTimelineProps {
  milestones: MilestoneItem[];
  activeMilestoneId: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:         { bg: "rgba(168,155,140,0.12)", text: "#A89B8C",  border: "rgba(168,155,140,0.25)" },
  AWAITING_ESCROW: { bg: "rgba(196,112,75,0.15)",  text: "#E8935A",  border: "rgba(196,112,75,0.35)"  },
  FUNDED:          { bg: "rgba(96,165,250,0.12)",  text: "#7DB8F7",  border: "rgba(96,165,250,0.3)"   },
  PROOF_SUBMITTED: { bg: "rgba(167,139,250,0.12)", text: "#C4ADFA",  border: "rgba(167,139,250,0.3)"  },
  PENDING_REVIEW:  { bg: "rgba(196,112,75,0.15)",  text: "#E8935A",  border: "rgba(196,112,75,0.35)"  },
  VERIFIED:        { bg: "rgba(74,222,128,0.12)",  text: "#6EE09A",  border: "rgba(74,222,128,0.3)"   },
  REJECTED:        { bg: "rgba(248,113,113,0.12)", text: "#F87171",  border: "rgba(248,113,113,0.3)"  },
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
  EXPIRED:         "Expired",
  COMPLETED:       "Completed",
};

export function MilestoneTimeline({ milestones, activeMilestoneId }: MilestoneTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                  <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "12px", color: "#A89B8C" }}>
                    <span>
                      <strong style={{ color: "#D4B896" }}>${Number(ms.amountUSD).toLocaleString()}</strong>{" "}RLUSD
                    </span>
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
                        Proofs Submitted
                      </p>
                      {ms.proofs.map((proof) => (
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
                          {proof.aiReasoning && (
                            <p style={{ fontSize: "12px", color: "#A89B8C", lineHeight: 1.5, margin: 0 }}>
                              {proof.aiReasoning}
                            </p>
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
