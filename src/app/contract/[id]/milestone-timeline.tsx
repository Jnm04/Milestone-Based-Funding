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
  PENDING:         { bg: "#f4f4f5", text: "#71717a", border: "#e4e4e7" },
  AWAITING_ESCROW: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  FUNDED:          { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  PROOF_SUBMITTED: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
  PENDING_REVIEW:  { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  VERIFIED:        { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  REJECTED:        { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  EXPIRED:         { bg: "#f4f4f5", text: "#71717a", border: "#e4e4e7" },
  COMPLETED:       { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
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
      <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">Milestones</h2>
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
                  background: isActive ? "#fffbeb" : isCompleted ? "#f0fdf4" : "#fff",
                  border: isExpanded
                    ? "1.5px solid #a1a1aa"
                    : isActive
                    ? "1.5px solid #fde68a"
                    : isCompleted
                    ? "1px solid #bbf7d0"
                    : "1px solid #e4e4e7",
                  borderRadius: isExpanded ? "12px 12px 0 0" : "12px",
                  opacity: isPending ? 0.75 : 1,
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
                    background: isCompleted ? "#16a34a" : isActive ? "#d97706" : "#e4e4e7",
                    color: isCompleted || isActive ? "#fff" : "#71717a",
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
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#18181b" }}>
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
                  <div style={{ display: "flex", gap: "16px", marginTop: "4px", fontSize: "12px", color: "#71717a" }}>
                    <span>
                      <strong style={{ color: "#18181b" }}>${Number(ms.amountUSD).toLocaleString()}</strong>{" "}RLUSD
                    </span>
                    <span>
                      Due:{" "}
                      <strong style={{ color: "#18181b" }}>
                        {new Date(ms.cancelAfter).toLocaleDateString("de-DE")}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Expand indicator */}
                <span style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "6px", flexShrink: 0 }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div
                  style={{
                    padding: "16px",
                    background: "#fafafa",
                    border: "1.5px solid #a1a1aa",
                    borderTop: "none",
                    borderRadius: "0 0 12px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* Escrow info */}
                  {ms.escrowSequence && (
                    <div style={{ fontSize: "12px", color: "#52525b" }}>
                      <span style={{ fontWeight: 600 }}>Escrow Sequence:</span>{" "}
                      <code style={{ fontFamily: "monospace" }}>{ms.escrowSequence}</code>
                    </div>
                  )}

                  {/* Proofs */}
                  {ms.proofs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <p style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Proofs Submitted
                      </p>
                      {ms.proofs.map((proof) => (
                        <div
                          key={proof.id}
                          style={{
                            padding: "10px 12px",
                            background: "#fff",
                            border: "1px solid #e4e4e7",
                            borderRadius: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", fontFamily: "monospace", background: "#f4f4f5", padding: "2px 6px", borderRadius: "4px", color: "#52525b" }}>
                              {proof.fileName.split(".").pop()?.toUpperCase() ?? "FILE"}
                            </span>
                            <a
                              href={proof.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: "13px", color: "#2563eb", textDecoration: "underline", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
                                  background: proof.aiDecision === "YES" ? "#dcfce7" : proof.aiDecision === "NO" ? "#fee2e2" : "#fef3c7",
                                  color: proof.aiDecision === "YES" ? "#166534" : proof.aiDecision === "NO" ? "#991b1b" : "#92400e",
                                }}
                              >
                                AI: {proof.aiDecision === "YES" ? "Approved" : proof.aiDecision === "NO" ? "Rejected" : "Review"}
                                {proof.aiConfidence !== null ? ` (${proof.aiConfidence}%)` : ""}
                              </span>
                            )}
                          </div>
                          {proof.aiReasoning && (
                            <p style={{ fontSize: "12px", color: "#71717a", lineHeight: 1.5, margin: 0 }}>
                              {proof.aiReasoning}
                            </p>
                          )}
                          <p style={{ fontSize: "11px", color: "#a1a1aa", margin: 0 }}>
                            {new Date(proof.createdAt).toLocaleString("de-DE")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: "12px", color: "#a1a1aa" }}>No proofs submitted yet for this milestone.</p>
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
