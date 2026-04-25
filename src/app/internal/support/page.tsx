"use client";

import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/internal-client";

interface SupportTicket {
  id: string;
  email: string | null;
  subject: string;
  messages: { role: string; content: string }[];
  status: string;
  priority: string;
  errorDigest: string | null;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  user: { email: string; name: string | null; role: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: "#ef4444",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#22c55e",
  CLOSED: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#6b7280",
};

const STATUSES = ["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function TicketRow({
  ticket,
  onUpdate,
}: {
  ticket: SupportTicket;
  onUpdate: (id: string, patch: Partial<SupportTicket>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(ticket.adminNote ?? "");
  const [saving, setSaving] = useState(false);

  async function update(patch: { status?: string; adminNote?: string }) {
    setSaving(true);
    try {
      const res = await internalFetch(`/api/support/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(ticket.id, updated);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(196,112,75,0.15)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500 }}>{ticket.subject}</div>
          <div style={{ fontSize: 11, color: "#A89B8C", marginTop: 2 }}>
            {ticket.user?.email ?? ticket.email ?? "anonymous"} ·{" "}
            {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[ticket.priority] }}>
          {ticket.priority}
        </span>
        {ticket.errorDigest && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            error
          </span>
        )}
        <select
          value={ticket.status}
          onChange={(e) => { e.stopPropagation(); update({ status: e.target.value }); }}
          disabled={saving}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(196,112,75,0.2)",
            borderRadius: 6,
            padding: "3px 8px",
            color: STATUS_COLORS[ticket.status] ?? "#EDE6DD",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
          }}
        >
          {STATUSES.slice(1).map((s) => (
            <option key={s} value={s} style={{ background: "#1e1a18", color: STATUS_COLORS[s] }}>
              {s}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A89B8C"
          strokeWidth="2"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Expanded conversation */}
      {expanded && (
        <div style={{ borderTop: "1px solid rgba(196,112,75,0.1)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ticket.messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10, color: "#A89B8C", textTransform: "uppercase" }}>{msg.role}</div>
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "8px 12px",
                    borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                    background: msg.role === "user" ? "rgba(196,112,75,0.15)" : "rgba(255,255,255,0.05)",
                    fontSize: 12,
                    color: "#EDE6DD",
                    lineHeight: 1.5,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Admin note */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "#A89B8C", marginBottom: 6 }}>ADMIN NOTE</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Internal note (not shown to user)…"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(196,112,75,0.2)",
                background: "rgba(255,255,255,0.04)",
                color: "#EDE6DD",
                fontSize: 12,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                onClick={() => update({ adminNote: note })}
                disabled={saving}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  background: "#C4704B",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#fff",
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Save note"}
              </button>
              {ticket.status !== "RESOLVED" && (
                <button
                  onClick={() => update({ status: "RESOLVED", adminNote: note })}
                  disabled={saving}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 6,
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#22c55e",
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  Mark resolved
                </button>
              )}
            </div>
          </div>

          {ticket.errorDigest && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#A89B8C" }}>
              Error digest: <code style={{ color: "#C4704B" }}>{ticket.errorDigest}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InternalSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await internalFetch(`/api/support/tickets${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(id: string, patch: Partial<SupportTicket>) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  const openCount = tickets.filter((t) => t.status === "OPEN").length;
  const highCount = tickets.filter((t) => t.priority === "HIGH" && t.status === "OPEN").length;

  return (
    <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 300,
            color: "#EDE6DD",
            fontFamily: "var(--font-libre-franklin)",
            marginBottom: 4,
          }}
        >
          Support Tickets
        </h1>
        <p style={{ fontSize: 13, color: "#A89B8C" }}>
          {total} total · {openCount} open{highCount > 0 ? ` · ${highCount} high priority` : ""}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: statusFilter === s ? "#C4704B" : "rgba(196,112,75,0.2)",
              background: statusFilter === s ? "rgba(196,112,75,0.15)" : "transparent",
              color: statusFilter === s ? "#C4704B" : "#A89B8C",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: statusFilter === s ? 600 : 400,
            }}
          >
            {s || "All"}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid rgba(196,112,75,0.2)",
            background: "transparent",
            color: "#A89B8C",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "#A89B8C", padding: 40 }}>Loading…</div>
      ) : tickets.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "#A89B8C",
            padding: 60,
            background: "rgba(255,255,255,0.02)",
            borderRadius: 12,
            border: "1px solid rgba(196,112,75,0.1)",
          }}
        >
          No tickets {statusFilter ? `with status ${statusFilter}` : "yet"}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
