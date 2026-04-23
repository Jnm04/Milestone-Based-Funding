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
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
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
            <a key={tab.href} href={tab.href} style={tabStyle(tab.href === "/enterprise/dashboard/settings/api-keys")}>
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* New key shown once */}
      {newSecret && (
        <div style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>
            API key created — save it now, it won't be shown again
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1,
              background: "white",
              border: "1px solid #A7F3D0",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 12.5,
              color: "#065F46",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}>
              {newSecret}
            </code>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? "#059669" : "#10B981",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#065F46" }}>
            Use this key in the <code style={{ fontFamily: "monospace" }}>Authorization: Bearer &lt;key&gt;</code> header.
          </p>
        </div>
      )}

      {/* Create form */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Create API key</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          API keys allow programmatic access to your enterprise attestation data. Each key is shown once — store it securely.
        </p>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. CI pipeline, Reporting script"
            maxLength={80}
            required
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="submit"
            disabled={creating}
            style={{
              background: creating ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "Creating…" : "Create key"}
          </button>
        </form>
      </div>

      {/* Key list */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
          Active keys ({keys.length})
        </h2>
        {loading ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>Loading…</p>
        ) : keys.length === 0 ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>No API keys yet.</p>
        ) : (
          <div>
            {keys.map((key, i) => (
              <div
                key={key.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--ent-border)",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                    {key.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)", fontFamily: "monospace" }}>
                    {key.keyPrefix}••••••••••••••••••••••••••••••••••••••••••••••••••••
                  </p>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <p style={{ margin: "0 0 3px", fontSize: 12, color: "var(--ent-muted)" }}>
                    {key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: "var(--ent-muted)" }}>
                    Created {new Date(key.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(key.id, key.name)}
                  disabled={revoking === key.id}
                  style={{
                    background: "none",
                    border: "1px solid #FCA5A5",
                    color: "#DC2626",
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {revoking === key.id ? "…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>
        API keys have read access to your attestation data. Never share keys in public repositories.
      </p>
    </div>
  );
}
