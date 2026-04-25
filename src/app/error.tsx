"use client";

import { useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  async function reportError() {
    setReporting(true);
    try {
      await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Error report: ${error.message?.slice(0, 80) ?? "Unknown error"}`,
          message: `Error: ${error.message ?? "Unknown"}\nDigest: ${error.digest ?? "—"}\nURL: ${typeof window !== "undefined" ? window.location.href : "—"}`,
          errorDigest: error.digest ?? null,
        }),
      });
      setReported(true);
    } catch {
      // silent — user sees the button again
    } finally {
      setReporting(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#171311" }}
    >
      <div
        className="w-full max-w-md flex flex-col items-center gap-6 p-8 rounded-2xl text-center"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold" style={{ color: "#EDE6DD" }}>
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          {error.digest && (
            <p className="text-xs font-mono" style={{ color: "rgba(168,155,140,0.5)" }}>
              {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={reset}
            className="cs-btn-primary"
          >
            Try again
          </button>

          {!reported ? (
            <button
              onClick={reportError}
              disabled={reporting}
              style={{
                padding: "9px 0",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(196,112,75,0.25)",
                color: reporting ? "#A89B8C" : "#C4704B",
                fontSize: 13,
                cursor: reporting ? "default" : "pointer",
                opacity: reporting ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {reporting ? "Sending report…" : "Report this error"}
            </button>
          ) : (
            <p style={{ fontSize: 12, color: "#22c55e" }}>
              Report sent — our team will look into it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
