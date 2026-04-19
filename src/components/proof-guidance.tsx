"use client";

import { useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuidanceChecklistItem {
  item: string;
  why: string;
}

export interface ProofGuidanceData {
  tone: string;
  checklist: GuidanceChecklistItem[];
  cachedAt?: string;
}

interface ProofGuidanceProps {
  contractId: string;
  milestoneId: string;
  /** Pre-fetched guidance from the server (null = not yet generated). */
  initialGuidance: ProofGuidanceData | null;
}

// ─── Sparkle icon ─────────────────────────────────────────────────────────────

function SparkleIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M5 17l.75 2.25L8 20l-2.25.75L5 23l-.75-2.25L2 20l2.25-.75L5 17z" />
      <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z" />
    </svg>
  );
}

function CheckIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <rect
        x="0.5"
        y="0.5"
        width="13"
        height="13"
        rx="3.5"
        stroke={checked ? "#C4704B" : "rgba(168,155,140,0.5)"}
        fill={checked ? "rgba(196,112,75,0.15)" : "transparent"}
        style={{ transition: "all 0.15s ease" }}
      />
      {checked && (
        <path
          d="M3.5 7L5.5 9L10.5 4.5"
          stroke="#C4704B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// ─── Guidance content panel ───────────────────────────────────────────────────

function GuidancePanel({ guidance }: { guidance: ProofGuidanceData }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(idx: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  const completedCount = checked.size;
  const totalCount = guidance.checklist.length;
  const allDone = completedCount === totalCount;

  return (
    <div className="flex flex-col gap-3">
      {/* Tone — encouraging opener */}
      <p
        className="text-sm leading-relaxed"
        style={{ color: "#D4B896", fontStyle: "italic" }}
      >
        {guidance.tone}
      </p>

      {/* Progress bar */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex-1 rounded-full overflow-hidden"
          style={{ height: 3, background: "rgba(196,112,75,0.15)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              background: allDone ? "#6EE09A" : "#C4704B",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        </div>
        <span
          className="text-xs tabular-nums"
          style={{ color: allDone ? "#6EE09A" : "#A89B8C", minWidth: "3rem", textAlign: "right", transition: "color 0.3s ease" }}
        >
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Checklist */}
      <div className="flex flex-col gap-1">
        {guidance.checklist.map((entry, idx) => {
          const isChecked = checked.has(idx);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => toggle(idx)}
              className="flex items-start gap-2.5 w-full text-left rounded-lg px-3 py-2.5 transition-colors"
              style={{
                background: isChecked ? "rgba(196,112,75,0.07)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${isChecked ? "rgba(196,112,75,0.25)" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
                transition: "background 0.15s ease, border-color 0.15s ease",
              }}
              aria-pressed={isChecked}
            >
              <CheckIcon checked={isChecked} />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span
                  className="text-sm font-medium leading-snug"
                  style={{
                    color: isChecked ? "rgba(237,230,221,0.55)" : "#EDE6DD",
                    textDecoration: isChecked ? "line-through" : "none",
                    transition: "color 0.15s ease",
                  }}
                >
                  {entry.item}
                </span>
                <span
                  className="text-xs leading-snug"
                  style={{ color: "#A89B8C" }}
                >
                  {entry.why}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Done state */}
      {allDone && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
          style={{
            background: "rgba(74,222,128,0.07)",
            border: "1px solid rgba(74,222,128,0.2)",
            color: "#6EE09A",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Checklist complete — you&apos;re ready to upload your proof!
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs" style={{ color: "rgba(168,155,140,0.6)" }}>
        Checkboxes are cosmetic — they don&apos;t affect submission. Upload your proof below when ready.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProofGuidance({ contractId, milestoneId, initialGuidance }: ProofGuidanceProps) {
  const [guidance, setGuidance] = useState<ProofGuidanceData | null>(initialGuidance);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(initialGuidance !== null);

  async function generateGuidance() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/milestones/${milestoneId}/guidance`,
        { method: "GET" }
      );

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to generate guidance");
      }

      const data = (await res.json()) as ProofGuidanceData;
      setGuidance(data);
      setExpanded(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate guidance. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Not yet generated — show CTA ──────────────────────────────────────────
  if (!guidance) {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border: "1px solid rgba(196,112,75,0.2)",
          background: "rgba(196,112,75,0.04)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-md w-6 h-6"
              style={{ background: "rgba(196,112,75,0.15)" }}
            >
              <span style={{ color: "#C4704B" }}>
                <SparkleIcon />
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#D4B896" }}>
                AI Proof Coach
              </p>
              <p className="text-xs" style={{ color: "#A89B8C" }}>
                Get a personalised checklist for this milestone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={generateGuidance}
            disabled={loading}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: loading ? "rgba(196,112,75,0.15)" : "#C4704B",
              color: loading ? "#C4704B" : "#171311",
              border: loading ? "1px solid rgba(196,112,75,0.3)" : "none",
              minWidth: "6.5rem",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg
                  className="animate-spin"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Coaching…
              </span>
            ) : (
              "Get Coaching"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Guidance available — collapsible panel ────────────────────────────────
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid rgba(196,112,75,0.25)",
        background: "rgba(196,112,75,0.04)",
      }}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{
          background: "transparent",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(196,112,75,0.15)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-md w-6 h-6"
            style={{ background: "rgba(196,112,75,0.15)" }}
          >
            <span style={{ color: "#C4704B" }}>
              <SparkleIcon />
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: "#D4B896" }}>
              AI Proof Coach
            </p>
            <p className="text-xs" style={{ color: "#A89B8C" }}>
              {expanded ? "Click to collapse" : "Click to see your checklist"}
            </p>
          </div>
        </div>
        {/* Chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A89B8C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4 pt-3">
          <GuidancePanel guidance={guidance} />
        </div>
      )}
    </div>
  );
}
