"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SsoConfig {
  provider: string;
  connectionId: string;
  domain: string;
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
  { href: "/enterprise/dashboard/settings/sso", label: "SSO" },
];

const PROVIDERS = [
  { value: "okta", label: "Okta" },
  { value: "azure", label: "Microsoft Entra ID (Azure AD)" },
  { value: "google", label: "Google Workspace" },
  { value: "saml", label: "Generic SAML 2.0" },
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

export default function SsoSettingsPage() {
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("okta");
  const [connectionId, setConnectionId] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/enterprise/sso");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
        setProvider(data.config.provider);
        setConnectionId(data.config.connectionId);
        setDomain(data.config.domain);
      }
    } catch {
      toast.error("Failed to load SSO configuration");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!connectionId.trim() || !domain.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/enterprise/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, connectionId: connectionId.trim(), domain: domain.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setConfig(data.config);
      toast.success("SSO configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove SSO configuration? Users will fall back to password authentication.")) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/enterprise/sso", { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setConfig(null);
      setConnectionId("");
      setDomain("");
      toast.success("SSO configuration removed");
    } catch {
      toast.error("Failed to remove SSO configuration");
    } finally {
      setRemoving(false);
    }
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
            const active = tab.href === "/enterprise/dashboard/settings/sso";
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

      {/* Status banner */}
      {!loading && config && (
        <div style={{
          background: "#ECFDF5",
          border: "1px solid #A7F3D0",
          borderRadius: 10,
          padding: "14px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>SSO is active</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#047857" }}>
              Provider: {PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider} · Domain: {config.domain}
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={removing}
            style={{
              background: "none",
              border: "1px solid #FECACA",
              color: removing ? "#FCA5A5" : "#DC2626",
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: removing ? "not-allowed" : "pointer",
            }}
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {/* Config form */}
      <div style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          {config ? "Update SSO Configuration" : "Configure SSO"}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          Connect your identity provider to enable single sign-on for your team. The domain must match your account&apos;s email domain.
        </p>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 40, borderRadius: 8, background: "var(--ent-bg)", opacity: 0.6 }} />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                Identity Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                Connection ID / App ID
              </label>
              <input
                type="text"
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                placeholder="e.g. 0oa5nm3..."
                required
                style={input}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
              />
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                The application or connection ID from your identity provider dashboard.
              </p>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                Email Domain
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. company.com"
                required
                style={input}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
              />
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                Users with this email domain will be redirected to your IdP for login.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? "#93C5FD" : "var(--ent-accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 24px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: saving ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
                }}
              >
                {saving ? "Saving…" : config ? "Update configuration" : "Save configuration"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Info card */}
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "#EFF6FF",
        border: "1px solid #BFDBFE",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 12.5,
        color: "#1E40AF",
      }}>
        <svg width="16" height="16" fill="none" stroke="#3B82F6" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>SAML 2.0 / OIDC</p>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            SSO is configured at the organisation level. Once active, team members logging in with your domain will be authenticated via your IdP.
            Existing password-based accounts remain valid as fallback.
          </p>
        </div>
      </div>

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
