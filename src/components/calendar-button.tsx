"use client";

import { useState } from "react";

interface CalendarButtonProps {
  contractId: string;
}

export function CalendarButton({ contractId }: CalendarButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/calendar?contractId=${contractId}`);
      if (!res.ok) throw new Error("Failed to generate calendar file");
      const text = await res.text();

      // Create a blob with the correct MIME type and trigger an auto-download.
      // This skips the browser "Save As" dialog on both Chrome and Safari on macOS —
      // the file lands directly in Downloads, and macOS opens it in Calendar.app on double-click.
      const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cascrow-milestones.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore — user can try again
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
      style={{
        background: "rgba(196,112,75,0.08)",
        border: "1px solid rgba(196,112,75,0.2)",
        color: "#A89B8C",
      }}
      title="Download milestone deadlines as .ics calendar file"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      {loading ? "Preparing…" : "Add to Calendar"}
    </button>
  );
}
