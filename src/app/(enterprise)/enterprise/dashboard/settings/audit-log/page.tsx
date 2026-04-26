"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface AuditEntry {
  id: string;
  action: string;
  detail: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
  { href: "/enterprise/dashboard/settings/sso", label: "SSO" },
  { href: "/enterprise/dashboard/settings/audit-log", label: "Audit Log" },
];

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  MEMBER_INVITED:     { bg: "#EFF6FF", color: "#1D4ED8" },
  MEMBER_REMOVED:     { bg: "#FEF2F2", color: "#DC2626" },
  MEMBER_ROLE_CHANGED:{ bg: "#FFFBEB", color: "#D97706" },
  SSO_CONFIGURED:     { bg: "#F0FDF4", color: "#16A34A" },
  SSO_REMOVED:        { bg: "#FEF2F2", color: "#DC2626" },
  API_KEY_CREATED:    { bg: "#F0FDF4", color: "#16A34A" },
  API_KEY_DELETED:    { bg: "#FEF2F2", color: "#DC2626" },
};

const ACTION_LABELS: Record<string, string> = {
  MEMBER_INVITED:      "Member Invited",
  MEMBER_REMOVED:      "Member Removed",
  MEMBER_ROLE_CHANGED: "Role Changed",
  SSO_CONFIGURED:      "SSO Configured",
  SSO_REMOVED:         "SSO Removed",
  API_KEY_CREATED:     "API Key Created",
  API_KEY_DELETED:     "API Key Deleted",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");

  async function load(p: number, action: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (action) params.set("action", action);
      const res = await fetch(`/api/enterprise/audit-log?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page, filterAction); }, [page, filterAction]);

  function handleFilterChange(action: string) {
    setFilterAction(action);
    setPage(1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/audit-log";
            return (
              <a
                key={tab.href}
                href={tab.href}
                style={{
                  padding: "8px 16px",
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--ent-accent)" : "var(--ent-muted)",
                  borderBottom: active ? "2px solid var(--ent-accent)" : "2px solid transparent",
                  textDecoration: "none",
                  marginBottom: -1,
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ent-muted)", fontWeight: 500 }}>Filter:</span>
        {["", ...Object.keys(ACTION_LABELS)].map(action => (
          <button
            key={action || "all"}
            onClick={() => handleFilterChange(action)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 99,
              border: "1px solid var(--ent-border)",
              background: filterAction === action ? "var(--ent-accent)" : "transparent",
              color: filterAction === action ? "white" : "var(--ent-muted)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {action ? (ACTION_LABELS[action] ?? action) : "All"}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--ent-border)", height: 56, background: i % 2 === 0 ? "#FAFAFA" : "white" }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>
              {filterAction ? "No events match this filter" : "No audit events yet"}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>
              {filterAction ? "Try clearing the filter." : "Team and SSO changes will appear here."}
            </p>
          </div>
        ) : (
          logs.map((entry, idx) => {
            const colors = ACTION_COLORS[entry.action] ?? { bg: "#F8FAFC", color: "#475569" };
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 20px",
                  borderBottom: idx === logs.length - 1 ? "none" : "1px solid var(--ent-border)",
                  background: idx % 2 === 0 ? "white" : "#FAFAFA",
                }}
              >
                {/* Action badge */}
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99,
                  background: colors.bg, color: colors.color,
                  whiteSpace: "nowrap", flexShrink: 0, marginTop: 2,
                }}>
                  {ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, " ")}
                </span>

                {/* Detail */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-text)", fontWeight: 500 }}>
                    {entry.detail ?? "—"}
                  </p>
                  {entry.actor && (
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                      by {entry.actor.name ?? entry.actor.email}
                    </p>
                  )}
                </div>

                {/* Time */}
                <span style={{ fontSize: 12, color: "var(--ent-muted)", whiteSpace: "nowrap", flexShrink: 0, marginTop: 3 }}>
                  {timeAgo(entry.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <span style={{ fontSize: 13, color: "var(--ent-muted)" }}>
            Page {page} of {totalPages} · {total} events
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--ent-border)", background: "white", color: page === 1 ? "#CBD5E1" : "var(--ent-text)", cursor: page === 1 ? "not-allowed" : "pointer" }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--ent-border)", background: "white", color: page === totalPages ? "#CBD5E1" : "var(--ent-text)", cursor: page === totalPages ? "not-allowed" : "pointer" }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 12.5, color: "var(--ent-muted)" }}>
        Audit logs are retained for 90 days. All times are UTC.
      </p>
    </div>
  );
}
