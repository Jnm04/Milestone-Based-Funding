"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const ALL_EVENTS = [
  { key: "attestation.completed", label: "Attestation completed", group: "Attestation" },
  { key: "proof.submitted", label: "Proof submitted", group: "Attestation" },
  { key: "ai.decision", label: "AI decision", group: "Attestation" },
  { key: "manual_review.required", label: "Manual review required", group: "Attestation" },
  { key: "manual_review.resolved", label: "Manual review resolved", group: "Attestation" },
  { key: "contract.created", label: "Contract created", group: "Contract" },
  { key: "contract.funded", label: "Contract funded", group: "Contract" },
  { key: "contract.expired", label: "Contract expired", group: "Contract" },
  { key: "contract.rejected", label: "Contract rejected", group: "Contract" },
  { key: "funds.released", label: "Funds released", group: "Contract" },
];

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
];

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 16,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13.5,
  border: "1px solid var(--ent-border)",
  borderRadius: 8,
  background: "var(--ent-bg)",
  color: "var(--ent-text)",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

export default function WebhooksSettingsPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["attestation.completed"]);
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setEndpoints(data.endpoints ?? []);
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  }

  function selectAll() {
    setSelectedEvents(ALL_EVENTS.map((e) => e.key));
  }

  function clearAll() {
    setSelectedEvents([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url || selectedEvents.length === 0) return;
    setCreating(true);
    setNewSecret(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: selectedEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setNewSecret(data.secret);
      setUrl("");
      setSelectedEvents(["attestation.completed"]);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(ep: WebhookEndpoint) {
    setToggling(ep.id);
    try {
      const res = await fetch(`/api/webhooks?id=${ep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !ep.active }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      setEndpoints((prev) => prev.map((x) => x.id === ep.id ? { ...x, active: !x.active } : x));
    } catch {
      toast.error("Failed to update webhook");
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEndpoints((prev) => prev.filter((x) => x.id !== id));
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeleting(null);
    }
  }

  async function handleRegenSecret(id: string) {
    if (!confirm("Regenerate the signing secret? The old secret will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error("Regenerate failed");
      setNewSecret(data.secret);
      toast.success("New secret generated — save it now");
    } catch {
      toast.error("Failed to regenerate secret");
    }
  }

  function handleCopy() {
    if (!newSecret) return;
    navigator.clipboard.writeText(newSecret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Group events by category
  const groups = Array.from(new Set(ALL_EVENTS.map((e) => e.group)));

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/webhooks";
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
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Signing secret banner */}
      {newSecret && (
        <div style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>
              Signing secret — save it now, it won&apos;t be shown again
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1,
              background: "white",
              border: "1px solid #A7F3D0",
              borderRadius: 7,
              padding: "9px 12px",
              fontSize: 12,
              color: "#065F46",
              fontFamily: "monospace",
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}>
              {newSecret}
            </code>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? "#059669" : "#10B981",
                color: "white",
                border: "none",
                borderRadius: 7,
                padding: "9px 16px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#065F46" }}>
            Verify requests:{" "}
            <code style={{ fontFamily: "monospace", background: "#D1FAE5", padding: "1px 5px", borderRadius: 3 }}>
              HMAC-SHA256(secret, &quot;t=&lt;timestamp&gt;.&lt;body&gt;&quot;)
            </code>{" "}
            must match the{" "}
            <code style={{ fontFamily: "monospace", background: "#D1FAE5", padding: "1px 5px", borderRadius: 3 }}>
              X-Cascrow-Signature
            </code>{" "}
            header.
          </p>
        </div>
      )}

      {/* Create form */}
      <div style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Add endpoint</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          cascrow sends a signed HTTP POST to your endpoint when subscribed events occur.
        </p>
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
              Endpoint URL (HTTPS required)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks/cascrow"
              required
              style={input}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)" }}>
                Events to subscribe to
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={selectAll} style={{ fontSize: 12, color: "var(--ent-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Select all
                </button>
                <span style={{ color: "var(--ent-border)" }}>·</span>
                <button type="button" onClick={clearAll} style={{ fontSize: 12, color: "var(--ent-muted)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Clear
                </button>
              </div>
            </div>
            {groups.map((group) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ent-muted)" }}>
                  {group}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_EVENTS.filter((e) => e.group === group).map((ev) => {
                    const checked = selectedEvents.includes(ev.key);
                    return (
                      <button
                        key={ev.key}
                        type="button"
                        onClick={() => toggleEvent(ev.key)}
                        style={{
                          padding: "5px 11px",
                          borderRadius: 7,
                          border: `1px solid ${checked ? "var(--ent-accent)" : "var(--ent-border)"}`,
                          background: checked ? "#EFF6FF" : "white",
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: checked ? 600 : 500,
                          color: checked ? "var(--ent-accent)" : "var(--ent-text)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          transition: "all 0.1s",
                        }}
                      >
                        {checked && (
                          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        {ev.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {selectedEvents.length === 0 && (
              <p style={{ fontSize: 12.5, color: "#DC2626", marginTop: 4 }}>Select at least one event.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={creating || selectedEvents.length === 0}
            style={{
              background: creating || selectedEvents.length === 0 ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: creating || selectedEvents.length === 0 ? "not-allowed" : "pointer",
              boxShadow: creating || selectedEvents.length === 0 ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
            }}
          >
            {creating ? "Adding…" : `Add endpoint (${selectedEvents.length} event${selectedEvents.length !== 1 ? "s" : ""})`}
          </button>
        </form>
      </div>

      {/* Endpoint list */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Endpoints</h2>
          {endpoints.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              padding: "2px 8px", borderRadius: 99,
              background: "var(--ent-bg)",
              color: "var(--ent-muted)",
              border: "1px solid var(--ent-border)",
            }}>
              {endpoints.length}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 80, borderRadius: 8, background: "var(--ent-bg)", opacity: 0.6 }} />
            ))}
          </div>
        ) : endpoints.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
              color: "var(--ent-accent)",
            }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>No endpoints yet</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>Add an endpoint above to start receiving events.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {endpoints.map((ep) => (
              <div key={ep.id} style={{
                border: `1px solid ${ep.active ? "var(--ent-border)" : "#E2E8F0"}`,
                borderRadius: 10,
                padding: "14px 16px",
                background: ep.active ? "white" : "var(--ent-bg)",
                opacity: ep.active ? 1 : 0.75,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 13, fontFamily: "monospace", color: "var(--ent-text)", wordBreak: "break-all", fontWeight: 500 }}>
                      {ep.url}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>
                      Added {new Date(ep.createdAt).toLocaleDateString("en-GB")} · {ep.events.length} event{ep.events.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: 600,
                    padding: "3px 9px", borderRadius: 99,
                    background: ep.active ? "#DCFCE7" : "#F3F4F6",
                    color: ep.active ? "#15803D" : "#6B7280",
                    flexShrink: 0,
                  }}>
                    {ep.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                  {ep.events.map((ev) => (
                    <span key={ev} style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 4,
                      background: "#EFF6FF", color: "#2563EB", fontWeight: 500,
                    }}>
                      {ev}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleToggle(ep)}
                    disabled={toggling === ep.id}
                    style={{
                      background: "none",
                      border: "1px solid var(--ent-border)",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      color: "var(--ent-text)",
                      fontWeight: 500,
                    }}
                  >
                    {toggling === ep.id ? "…" : ep.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleRegenSecret(ep.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--ent-border)",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      color: "var(--ent-text)",
                      fontWeight: 500,
                    }}
                  >
                    Rotate secret
                  </button>
                  <button
                    onClick={() => handleDelete(ep.id)}
                    disabled={deleting === ep.id}
                    style={{
                      background: "none",
                      border: "1px solid #FECACA",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: "pointer",
                      color: "#DC2626",
                      fontWeight: 600,
                    }}
                  >
                    {deleting === ep.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
