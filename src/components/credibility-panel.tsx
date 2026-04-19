"use client";

import { useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CredibilitySignal {
  label: string;
  value: string;
  positive: boolean;
}

export interface CredibilityScoreData {
  score: number;
  tier: "HIGH" | "MEDIUM" | "LOW";
  signals: CredibilitySignal[];
  summary: string;
  cachedAt: string;
}

interface CredibilityPanelProps {
  contractId: string;
  startupName: string | null;
  /** Pre-fetched score from the server (null = not yet generated). */
  initialScore: CredibilityScoreData | null;
  /** Start collapsed — used when contract is already funded (past the decision point). */
  defaultCollapsed?: boolean;
}

// ─── Score colours ────────────────────────────────────────────────────────────

function tierColor(tier: "HIGH" | "MEDIUM" | "LOW") {
  if (tier === "HIGH") return { text: "#6EE09A", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.25)" };
  if (tier === "MEDIUM") return { text: "#E8935A", bg: "rgba(196,112,75,0.12)", border: "rgba(196,112,75,0.3)" };
  return { text: "#F87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" };
}

function tierLabel(tier: "HIGH" | "MEDIUM" | "LOW") {
  if (tier === "HIGH") return "High Credibility";
  if (tier === "MEDIUM") return "Moderate Credibility";
  return "Low Credibility";
}

// ─── Circular score badge ─────────────────────────────────────────────────────

function ScoreBadge({ score, tier }: { score: number; tier: "HIGH" | "MEDIUM" | "LOW" }) {
  const colors = tierColor(tier);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        {/* Track */}
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
        {/* Fill */}
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={colors.text}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums leading-none" style={{ color: colors.text }}>
          {score}
        </span>
        <span className="text-xs leading-none mt-0.5" style={{ color: "rgba(168,155,140,0.7)" }}>/ 100</span>
      </div>
    </div>
  );
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: CredibilitySignal }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {/* Dot */}
      <span
        className="mt-0.5 flex-shrink-0 rounded-full"
        style={{
          width: 7,
          height: 7,
          background: signal.positive ? "#6EE09A" : "#F87171",
          marginTop: 5,
        }}
        aria-hidden="true"
      />
      <div className="flex items-baseline justify-between gap-2 w-full min-w-0">
        <span className="text-xs" style={{ color: "#A89B8C" }}>{signal.label}</span>
        <span
          className="text-xs font-medium text-right flex-shrink-0"
          style={{ color: signal.positive ? "#C8E6C9" : "#FFCDD2" }}
        >
          {signal.value}
        </span>
      </div>
    </div>
  );
}

// ─── Score panel (when data is available) ─────────────────────────────────────

function ScorePanel({
  score,
  onRecalculate,
  recalculating,
}: {
  score: CredibilityScoreData;
  onRecalculate: () => void;
  recalculating: boolean;
}) {
  const colors = tierColor(score.tier);
  const hoursAgo = Math.round((Date.now() - new Date(score.cachedAt).getTime()) / 3_600_000);
  const ageLabel = hoursAgo < 1 ? "just now" : hoursAgo === 1 ? "1 hour ago" : `${hoursAgo} hours ago`;

  return (
    <div className="flex flex-col gap-3">
      {/* Score row */}
      <div className="flex items-center gap-4">
        <ScoreBadge score={score.score} tier={score.tier} />
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: colors.text }}
          >
            {tierLabel(score.tier)}
          </span>
          <p className="text-sm leading-relaxed" style={{ color: "#D4B896" }}>
            {score.summary}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "rgba(196,112,75,0.12)" }} />

      {/* Signal list */}
      <div className="flex flex-col">
        {score.signals.map((s, i) => (
          <SignalRow key={i} signal={s} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs" style={{ color: "rgba(168,155,140,0.5)" }}>
          Score calculated {ageLabel} · refreshes every 7 days
        </span>
        <button
          type="button"
          onClick={onRecalculate}
          disabled={recalculating}
          className="flex items-center gap-1.5 text-xs disabled:opacity-50 transition-opacity"
          style={{ color: "#A89B8C" }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={recalculating ? "animate-spin" : ""}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          {recalculating ? "Recalculating…" : "Recalculate"}
        </button>
      </div>
    </div>
  );
}

// ─── Shield icon ──────────────────────────────────────────────────────────────

function ShieldIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CredibilityPanel({
  contractId,
  startupName,
  initialScore,
  defaultCollapsed = false,
}: CredibilityPanelProps) {
  const [score, setScore] = useState<CredibilityScoreData | null>(initialScore);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(initialScore !== null && !defaultCollapsed);

  async function fetchScore(force = false) {
    setLoading(true);
    try {
      const url = `/api/contracts/${contractId}/credibility${force ? "?force=1" : ""}`;
      const res = await fetch(url, { method: "GET" });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to generate credibility score");
      }

      const data = (await res.json()) as CredibilityScoreData;
      setScore(data);
      setExpanded(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not generate score. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Not yet generated ─────────────────────────────────────────────────────
  if (!score) {
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
              className="flex items-center justify-center rounded-md w-6 h-6 flex-shrink-0"
              style={{ background: "rgba(196,112,75,0.15)" }}
            >
              <span style={{ color: "#C4704B" }}>
                <ShieldIcon />
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#D4B896" }}>
                AI Credibility Score
              </p>
              <p className="text-xs" style={{ color: "#A89B8C" }}>
                {startupName ? `Analyse ${startupName} before funding` : "Analyse the receiver before funding"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchScore()}
            disabled={loading}
            className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
            style={{
              background: loading ? "rgba(196,112,75,0.15)" : "#C4704B",
              color: loading ? "#C4704B" : "#171311",
              border: loading ? "1px solid rgba(196,112,75,0.3)" : "none",
              minWidth: "7rem",
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
                Analysing…
              </span>
            ) : (
              "Score Receiver"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Score available — collapsible panel ───────────────────────────────────
  const colors = tierColor(score.tier);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${colors.border}`,
        background: "rgba(255,255,255,0.025)",
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
          borderBottom: expanded ? "1px solid rgba(196,112,75,0.12)" : "none",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-md w-6 h-6 flex-shrink-0"
            style={{ background: `${colors.bg}` }}
          >
            <span style={{ color: colors.text }}>
              <ShieldIcon />
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: "#D4B896" }}>
              AI Credibility Score
            </p>
            <p className="text-xs" style={{ color: "#A89B8C" }}>
              {expanded ? "Click to collapse" : `${score.score}/100 — ${tierLabel(score.tier)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Score pill */}
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full tabular-nums"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {score.score}
          </span>
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
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4 pt-3">
          <ScorePanel
            score={score}
            onRecalculate={() => fetchScore(true)}
            recalculating={loading}
          />
        </div>
      )}
    </div>
  );
}
