"use client";

import { useEffect, useState } from "react";

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: "error" | "warning" | "info" | "fatal";
  status: string;
  permalink: string;
}

const LEVEL_COLOR: Record<string, string> = {
  fatal: "#ef4444",
  error: "#f87171",
  warning: "#fb923c",
  info: "#60a5fa",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ErrorsPage() {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = sessionStorage.getItem("cascrow_internal_key") ?? "";
    fetch("/api/internal/sentry-issues", { headers: { "x-internal-key": key } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error && !data.issues?.length) setError(data.error);
        else setIssues(data.issues ?? []);
      })
      .catch(() => setError("Failed to load issues"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 4 }}>Error Monitoring</h1>
        <p style={{ color: "#A89B8C", fontSize: 14 }}>
          Live unresolved issues from Sentry — last 25, sorted by most recent.
        </p>
      </div>

      {loading && (
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Loading…</p>
      )}

      {error && (
        <div style={{ padding: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, fontSize: 13, color: "#f87171" }}>
          {error === "Sentry not configured"
            ? "Sentry is not yet configured. Add SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT to your environment variables."
            : error}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#A89B8C", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12, fontSize: 13 }}>
          ✓ No unresolved issues in Sentry.
        </div>
      )}

      {issues.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {issues.map((issue) => (
            <a
              key={issue.id}
              href={issue.permalink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <div
                style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 10, display: "flex", gap: 16, alignItems: "flex-start", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.4)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.15)")}
              >
                {/* Level badge */}
                <span style={{ fontSize: 10, fontWeight: 600, color: LEVEL_COLOR[issue.level] ?? "#A89B8C", textTransform: "uppercase", letterSpacing: "0.1em", paddingTop: 2, minWidth: 40 }}>
                  {issue.level}
                </span>

                {/* Title + culprit */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#EDE6DD", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {issue.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#A89B8C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {issue.culprit}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "#EDE6DD" }}>{Number(issue.count).toLocaleString()} events</span>
                  <span style={{ fontSize: 11, color: "#A89B8C" }}>last {timeAgo(issue.lastSeen)}</span>
                  {issue.userCount > 0 && (
                    <span style={{ fontSize: 11, color: "#A89B8C" }}>{issue.userCount} user{issue.userCount !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
