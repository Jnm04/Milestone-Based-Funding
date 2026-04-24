"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
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

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/enterprise/api-keys");
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setNewSecret(null);
    try {
      const res = await fetch("/api/enterprise/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setNewSecret(data.secret);
      setName("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, keyName: string) {
    if (!confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/enterprise/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Revoke failed");
      toast.success("API key revoked");
      setKeys((k) => k.filter((x) => x.id !== id));
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevoking(null);
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
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/api-keys";
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

      {/* New key banner */}
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
              API key created — save it now, it won&apos;t be shown again
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1,
              background: "white",
              border: "1px solid #A7F3D0",
              borderRadius: 7,
              padding: "9px 12px",
              fontSize: 12.5,
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
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "background 0.15s",
              }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#065F46" }}>
            Use this key in the{" "}
            <code style={{ fontFamily: "monospace", background: "#D1FAE5", padding: "1px 5px", borderRadius: 3 }}>
              Authorization: Bearer &lt;key&gt;
            </code>{" "}
            header when making API requests.
          </p>
        </div>
      )}

      {/* Create form */}
      <div style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Create API key</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          API keys grant programmatic access to your enterprise attestation data. Each key is shown once — store it securely.
        </p>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI pipeline, Reporting dashboard, Finance export"
            maxLength={80}
            required
            style={{ ...input, flex: 1 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
          />
          <button
            type="submit"
            disabled={creating}
            style={{
              background: creating ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              boxShadow: creating ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
            }}
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>
      </div>

      {/* Key list */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
            Active keys
          </h2>
          {keys.length > 0 && (
            <span style={{
              fontSize: 12, fontWeight: 600,
              padding: "2px 8px", borderRadius: 99,
              background: "var(--ent-bg)",
              color: "var(--ent-muted)",
              border: "1px solid var(--ent-border)",
            }}>
              {keys.length}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 52, borderRadius: 8, background: "var(--ent-bg)", opacity: 0.6 }} />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
              color: "var(--ent-accent)",
            }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>No API keys yet</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>Create your first key to access the API.</p>
          </div>
        ) : (
          <div>
            {keys.map((key, i) => (
              <div
                key={key.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--ent-border)",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                      {key.name}
                    </p>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: "1px 6px", borderRadius: 4,
                      background: "#ECFDF5", color: "#059669",
                    }}>
                      Active
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)", fontFamily: "monospace", letterSpacing: "0.02em" }}>
                    {key.keyPrefix}{'•'.repeat(32)}
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 12, color: "var(--ent-muted)" }}>
                    {key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString("en-GB")}`
                      : "Never used"}
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: "#94A3B8" }}>
                    Created {new Date(key.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(key.id, key.name)}
                  disabled={revoking === key.id}
                  style={{
                    background: "none",
                    border: "1px solid #FECACA",
                    color: revoking === key.id ? "#FCA5A5" : "#DC2626",
                    borderRadius: 7,
                    padding: "6px 14px",
                    fontSize: 12.5,
                    cursor: revoking === key.id ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {revoking === key.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "#FFFBEB",
        border: "1px solid #FDE68A",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12.5,
        color: "#92400E",
      }}>
        <svg width="16" height="16" fill="none" stroke="#D97706" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        API keys have read access to your attestation data. Never share keys in public repositories or client-side code.
      </div>

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
