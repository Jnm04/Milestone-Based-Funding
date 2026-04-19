"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export interface MilestoneChange {
  milestoneId: string;
  title: string;
  origAmountUSD: string;
  origCancelAfter: string;
  newAmountUSD?: string;
  newCancelAfter?: string;
}

export interface CounterProposalData {
  id: string;
  status: string;
  milestoneChanges: MilestoneChange[];
  rationale: string;
  aiImprovedRationale?: string | null;
  respondedAt?: string | null;
  createdAt: string;
}

interface Props {
  contractId: string;
  counterProposal: CounterProposalData;
  startupName?: string | null;
}

export function CounterProposalBanner({ contractId, counterProposal, startupName }: Props) {
  const router = useRouter();
  const [responding, setResponding] = useState<"ACCEPT" | "REJECT" | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [done, setDone] = useState(false);
  const [finalDecision, setFinalDecision] = useState<"ACCEPTED" | "REJECTED" | null>(null);

  const cp = counterProposal;
  const changes = cp.milestoneChanges ?? [];

  // Already responded
  if (cp.status === "ACCEPTED" || cp.status === "REJECTED" || done) {
    const accepted = (cp.status === "ACCEPTED" || finalDecision === "ACCEPTED");
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${accepted ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.2)"}`,
        }}
      >
        <div
          className="px-5 py-3 flex items-center gap-3"
          style={{ background: accepted ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)" }}
        >
          <span style={{ fontSize: 14, color: accepted ? "#34d399" : "#f87171" }}>
            {accepted ? "✓" : "✕"}
          </span>
          <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>
            Counter-proposal {accepted ? "accepted" : "rejected"}
          </span>
          <span className="text-xs ml-auto" style={{ color: "#A89B8C" }}>
            {cp.respondedAt ? new Date(cp.respondedAt).toLocaleDateString() : ""}
          </span>
        </div>
        {accepted && (
          <div className="px-5 py-3">
            <p className="text-xs" style={{ color: "#A89B8C" }}>
              The proposed terms have been applied. Contract is now awaiting escrow funding.
            </p>
          </div>
        )}
      </div>
    );
  }

  async function respond(decision: "ACCEPT" | "REJECT") {
    setResponding(decision);
    try {
      const res = await fetch(`/api/contracts/${contractId}/counter-proposal/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setFinalDecision(decision === "ACCEPT" ? "ACCEPTED" : "REJECTED");
      setDone(true);
      toast.success(decision === "ACCEPT" ? "Counter-proposal accepted. Terms updated." : "Counter-proposal rejected.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to respond.");
    } finally {
      setResponding(null);
    }
  }

  const hasChanges = changes.some((mc) => mc.newAmountUSD !== undefined || mc.newCancelAfter !== undefined);
  const displayRationale = cp.aiImprovedRationale ?? cp.rationale;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(212,160,60,0.3)",
        borderTop: "2px solid #D4A03C",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: "rgba(212,160,60,0.06)" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(212,160,60,0.15)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D4A03C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "#EDE6DD" }}>
            Counter-proposal received
          </p>
          <p className="text-xs" style={{ color: "#A89B8C" }}>
            <strong style={{ color: "#D4B896" }}>{startupName ?? "The Receiver"}</strong>
            {" "}proposed changes · {new Date(cp.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className="px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
          style={{ background: "rgba(212,160,60,0.12)", color: "#D4A03C", border: "1px solid rgba(212,160,60,0.3)" }}
        >
          Pending
        </span>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {/* Milestone changes comparison */}
        {hasChanges && (
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wide" style={{ color: "#A89B8C" }}>
              Proposed milestone changes
            </p>
            <div className="flex flex-col gap-2">
              {changes.map((mc) => {
                const amountChanged = mc.newAmountUSD !== undefined && mc.newAmountUSD !== mc.origAmountUSD;
                const deadlineChanged = mc.newCancelAfter !== undefined;
                if (!amountChanged && !deadlineChanged) return null;
                return (
                  <div
                    key={mc.milestoneId}
                    className="p-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)" }}
                  >
                    <p className="text-xs font-semibold mb-2" style={{ color: "#EDE6DD" }}>{mc.title}</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
                      {amountChanged && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: "#A89B8C" }}>Amount:</span>
                          <span style={{ color: "#A89B8C", textDecoration: "line-through" }}>
                            ${Number(mc.origAmountUSD).toLocaleString()}
                          </span>
                          <span style={{ color: "#34d399", fontWeight: 600 }}>
                            ${Number(mc.newAmountUSD).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {deadlineChanged && (
                        <div className="flex items-center gap-2">
                          <span style={{ color: "#A89B8C" }}>Deadline:</span>
                          <span style={{ color: "#A89B8C", textDecoration: "line-through" }}>
                            {new Date(mc.origCancelAfter).toLocaleDateString()}
                          </span>
                          <span style={{ color: "#34d399", fontWeight: 600 }}>
                            {new Date(mc.newCancelAfter!).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* Rationale */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowRationale((v) => !v)}
            className="flex items-center gap-2 text-xs uppercase tracking-wide text-left"
            style={{ color: "#A89B8C" }}
          >
            <svg
              width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showRationale ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
            >
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            Startup&apos;s rationale
            {cp.aiImprovedRationale && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(196,112,75,0.12)", color: "#C4704B", fontSize: 9 }}>
                AI-polished
              </span>
            )}
          </button>
          {showRationale && (
            <blockquote
              className="text-sm leading-relaxed"
              style={{
                borderLeft: "3px solid rgba(212,160,60,0.4)",
                margin: 0,
                paddingLeft: 12,
                color: "#D4B896",
                fontStyle: "italic",
              }}
            >
              {displayRationale}
            </blockquote>
          )}
        </div>

        {/* Accept / Reject */}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={() => respond("ACCEPT")}
            disabled={responding !== null}
            className="cs-btn-primary cs-btn-sm"
          >
            {responding === "ACCEPT" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border animate-spin" style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                Accepting…
              </span>
            ) : "Accept Counter-Proposal"}
          </button>
          <button
            onClick={() => respond("REJECT")}
            disabled={responding !== null}
            className="cs-btn-ghost cs-btn-sm"
            style={{ borderColor: "rgba(248,113,113,0.4)", color: "#f87171" }}
          >
            {responding === "REJECT" ? "Rejecting…" : "Reject"}
          </button>
        </div>
        <p className="text-xs" style={{ color: "#6B5E52" }}>
          Accepting applies the proposed terms immediately. Rejecting returns the original invite to the Receiver.
        </p>
      </div>
    </div>
  );
}
