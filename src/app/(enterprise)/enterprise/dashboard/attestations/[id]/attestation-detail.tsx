"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface LatestProof {
  id: string;
  aiDecision: string | null;
  aiReasoning: string | null;
  aiConfidence: number | null;
  aiModelVotes: unknown;
  createdAt: string;
  fileName: string;
}

interface MilestoneData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  cancelAfter: string;
  order: number;
  latestProof: LatestProof | null;
}

interface GoalSet {
  id: string;
  title: string;
}

interface Props {
  goalSet: GoalSet;
  milestones: MilestoneData[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  FUNDED:          { label: "Ready",        color: "#2563EB", bg: "#EFF6FF" },
  PROOF_SUBMITTED: { label: "Under Review", color: "#D97706", bg: "#FFFBEB" },
  VERIFIED:        { label: "Verified",     color: "#059669", bg: "#ECFDF5" },
  COMPLETED:       { label: "Completed",    color: "#059669", bg: "#ECFDF5" },
  REJECTED:        { label: "Rejected",     color: "#DC2626", bg: "#FEF2F2" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#64748B", bg: "#F8FAFC" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      color: cfg.color,
      background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function PulsingDot() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "#2563EB",
        display: "inline-block",
        animation: "pulse-dot 1.4s ease-in-out infinite",
      }} />
    </span>
  );
}

interface MilestoneCardProps {
  milestone: MilestoneData;
  goalSetId: string;
  onStatusChange: (milestoneId: string, newStatus: string, newProof: LatestProof | null) => void;
}

function MilestoneCard({ milestone, goalSetId, onStatusChange }: MilestoneCardProps) {
  const [uploading, setUploading] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function pollForStatusChange() {
    setAnalysing(true);
    let attempts = 0;
    const maxAttempts = 60; // 3 minutes max

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        stopPolling();
        setAnalysing(false);
        toast.error("Analysis timed out. Please refresh the page.");
        return;
      }

      try {
        const res = await fetch(`/api/enterprise/attestations/${goalSetId}`);
        if (!res.ok) return;
        const data = await res.json();
        const updated = data.contract?.milestones?.find((m: MilestoneData) => m.id === milestone.id);
        if (!updated) return;

        if (updated.status !== "PROOF_SUBMITTED") {
          stopPolling();
          setAnalysing(false);
          onStatusChange(milestone.id, updated.status, updated.latestProof);
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("milestoneId", milestone.id);

      const res = await fetch("/api/proof/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      setUploading(false);
      onStatusChange(milestone.id, "PROOF_SUBMITTED", null);
      await pollForStatusChange();
    } catch (err) {
      setUploading(false);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileUpload(file);
    }
    // reset so same file can be re-uploaded
    e.target.value = "";
  }

  const canUpload = milestone.status === "FUNDED" || milestone.status === "REJECTED";
  const isPositive = ["VERIFIED", "COMPLETED"].includes(milestone.status);
  const isNegative = milestone.status === "REJECTED";
  const deadline = new Date(milestone.cancelAfter);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000);

  return (
    <div style={{
      background: "white",
      border: "1px solid var(--ent-border)",
      borderRadius: 12,
      padding: "24px",
      marginBottom: 16,
    }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: milestone.description ? 12 : 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              #{milestone.order}
            </span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>{milestone.title}</h3>
            <StatusBadge status={milestone.status} />
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: daysLeft < 0 ? "#DC2626" : daysLeft <= 7 ? "#D97706" : "var(--ent-muted)", whiteSpace: "nowrap", fontWeight: daysLeft <= 7 ? 600 : 400 }}>
          {daysLeft < 0 ? "Overdue" : daysLeft === 0 ? "Due today" : `Due ${deadline.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        </div>
      </div>

      {/* Description */}
      {milestone.description && (
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ent-muted)", lineHeight: 1.55 }}>
          {milestone.description}
        </p>
      )}

      {/* Analysing state */}
      {analysing && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13.5,
          color: "#1D4ED8",
          fontWeight: 500,
        }}>
          <PulsingDot />
          Analysis in progress… AI models are reviewing your evidence.
        </div>
      )}

      {/* Result card — Verified */}
      {isPositive && milestone.latestProof && (
        <div style={{
          padding: "14px 16px",
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
              Evidence Verified
              {milestone.latestProof.aiConfidence !== null && (
                <span style={{ fontWeight: 500, marginLeft: 6 }}>({milestone.latestProof.aiConfidence}% confidence)</span>
              )}
            </span>
          </div>
          {milestone.latestProof.aiReasoning && (
            <p style={{ margin: 0, fontSize: 13, color: "#065F46", lineHeight: 1.5 }}>
              {milestone.latestProof.aiReasoning.slice(0, 300)}{milestone.latestProof.aiReasoning.length > 300 ? "…" : ""}
            </p>
          )}
        </div>
      )}

      {/* Result card — Rejected */}
      {isNegative && milestone.latestProof && (
        <div style={{
          padding: "14px 16px",
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <svg width="16" height="16" fill="none" stroke="#DC2626" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Evidence Not Verified</span>
          </div>
          {milestone.latestProof.aiReasoning && (
            <p style={{ margin: 0, fontSize: 13, color: "#7F1D1D", lineHeight: 1.5 }}>
              {milestone.latestProof.aiReasoning.slice(0, 300)}{milestone.latestProof.aiReasoning.length > 300 ? "…" : ""}
            </p>
          )}
        </div>
      )}

      {/* Upload area */}
      {canUpload && !analysing && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: uploading ? "#E0E7FF" : isNegative ? "white" : "var(--ent-accent)",
              color: uploading ? "#6366F1" : isNegative ? "var(--ent-text)" : "white",
              border: isNegative ? "1px solid var(--ent-border)" : "none",
              borderRadius: 7,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            {uploading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Uploading…
              </>
            ) : isNegative ? (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload New Evidence
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload Evidence
              </>
            )}
          </button>
        </>
      )}

      {/* Under review — no upload */}
      {milestone.status === "PROOF_SUBMITTED" && !analysing && (
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 14px",
          background: "#FFFBEB",
          border: "1px solid #FDE68A",
          borderRadius: 7,
          fontSize: 13,
          color: "#92400E",
          fontWeight: 500,
        }}>
          <PulsingDot />
          Evidence under review
        </div>
      )}
    </div>
  );
}

export function AttestationDetail({ goalSet, milestones: initialMilestones }: Props) {
  const [milestones, setMilestones] = useState<MilestoneData[]>(initialMilestones);

  function handleStatusChange(milestoneId: string, newStatus: string, newProof: LatestProof | null) {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === milestoneId
          ? { ...m, status: newStatus, latestProof: newProof ?? m.latestProof }
          : m
      )
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
      {milestones.map((m) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          goalSetId={goalSet.id}
          onStatusChange={handleStatusChange}
        />
      ))}
    </>
  );
}
