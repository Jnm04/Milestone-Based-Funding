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
  "attestation.completed",
  "contract.created",
  "contract.funded",
  "contract.expired",
  "contract.rejected",
  "proof.submitted",
  "ai.decision",
  "manual_review.required",
  "manual_review.resolved",
  "funds.released",
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  fontSize: 13.5,
  fontWeight: active ? 600 : 500,
  color: active ? "var(--ent-accent)" : "var(--ent-muted)",
  borderBottom: active ? "2px solid var(--ent-accent)" : "2px solid transparent",
  textDecoration: "none",
  marginBottom: -1,
});

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 20,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  fontSize: 13.5,
  border: "1px solid var(--ent-border)",
  borderRadius: 7,
  background: "white",
  color: "var(--ent-text)",
  outline: "none",
  boxSizing: "border-box",
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

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--ent-border)", marginBottom: 28 }}>
          {[
            { href: "/enterprise/dashboard/settings", label: "Profile" },
            { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
            { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
            { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
          ].map((tab) => (
            <a key={tab.href} href={tab.href} style={tabStyle(tab.href === "/enterprise/dashboard/settings/webhooks")}>
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* Secret banner */}
      {newSecret && (
        <div style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>
            Signing secret — save it now, it won't be shown again
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1,
              background: "white",
              border: "1px solid #A7F3D0",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12,
              color: "#065F46",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}>
              {newSecret}
            </code>
            <button onClick={handleCopy} style={{
              background: copied ? "#059669" : "#10B981",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#065F46" }}>
            Verify: <code style={{ fontFamily: "monospace" }}>HMAC-SHA256(secret, &quot;t=&lt;ts&gt;.&lt;body&gt;&quot;)</code> must match <code style={{ fontFamily: "monospace" }}>X-Cascrow-Signature</code>.
          </p>
        </div>
      )}

      {/* Create form */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Add endpoint</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          cascrow sends a signed HTTP POST to this URL when subscribed events occur.
        </p>
        <form onSubmit={handleCreate}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 6 }}>
              Endpoint URL (HTTPS)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks/cascrow"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 10 }}>
              Events to subscribe to
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ALL_EVENTS.map((ev) => (
                <label
                  key={ev}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1px solid ${selectedEvents.includes(ev) ? "var(--ent-accent)" : "var(--ent-border)"}`,
                    background: selectedEvents.includes(ev) ? "#EFF6FF" : "white",
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: selectedEvents.includes(ev) ? "var(--ent-accent)" : "var(--ent-text)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    style={{ margin: 0, accentColor: "var(--ent-accent)" }}
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || selectedEvents.length === 0}
            style={{
              background: creating ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "9px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Adding…" : "Add endpoint"}
          </button>
        </form>
      </div>

      {/* Endpoint list */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
          Endpoints ({endpoints.length})
        </h2>
        {loading ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>Loading…</p>
        ) : endpoints.length === 0 ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>No webhook endpoints yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {endpoints.map((ep) => (
              <div key={ep.id} style={{
                border: "1px solid var(--ent-border)",
                borderRadius: 8,
                padding: "14px 16px",
                background: ep.active ? "white" : "#F9FAFB",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 13, fontFamily: "monospace", color: "var(--ent-text)", wordBreak: "break-all" }}>
                      {ep.url}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>
                      Created {new Date(ep.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 99,
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
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "#EFF6FF",
                      color: "#2563EB",
                      fontWeight: 500,
                    }}>
                      {ev}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleToggle(ep)}
                    disabled={toggling === ep.id}
                    style={{
                      background: "none",
                      border: "1px solid var(--ent-border)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "var(--ent-text)",
                      fontWeight: 500,
                    }}
                  >
                    {ep.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleRegenSecret(ep.id)}
                    style={{
                      background: "none",
                      border: "1px solid var(--ent-border)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
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
                      border: "1px solid #FCA5A5",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      color: "#DC2626",
                      fontWeight: 600,
                    }}
                  >
                    {deleting === ep.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
