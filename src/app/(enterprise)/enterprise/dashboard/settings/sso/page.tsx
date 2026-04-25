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
  { href: "/enterprise/dashboard/settings/sso", label: "SSO · Beta" },
];

const PROVIDERS = [
  { value: "OKTA", label: "Okta" },
  { value: "AZURE_AD", label: "Microsoft Entra ID (Azure AD)" },
  { value: "GOOGLE_WORKSPACE", label: "Google Workspace" },
  { value: "SAML", label: "Generic SAML 2.0" },
];

const PROVIDER_DOCS: Record<string, { acsUrl: string; entityId: string; guide: string }> = {
  OKTA: {
    acsUrl: "https://cascrow.com/api/auth/saml/callback",
    entityId: "https://cascrow.com",
    guide: "In Okta: Applications → Create App Integration → SAML 2.0. Set the values below in the 'Configure SAML' step.",
  },
  AZURE_AD: {
    acsUrl: "https://cascrow.com/api/auth/saml/callback",
    entityId: "https://cascrow.com",
    guide: "In Azure Portal: Enterprise Applications → New application → Create your own → Non-gallery. Set the values below in 'Set up single sign-on'.",
  },
  GOOGLE_WORKSPACE: {
    acsUrl: "https://cascrow.com/api/auth/saml/callback",
    entityId: "https://cascrow.com",
    guide: "In Google Admin: Apps → Web and mobile apps → Add app → Add custom SAML app. Set the values below in the Service Provider Details step.",
  },
  SAML: {
    acsUrl: "https://cascrow.com/api/auth/saml/callback",
    entityId: "https://cascrow.com",
    guide: "Configure your SAML 2.0 identity provider with the Service Provider values below.",
  },
};

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
  const [provider, setProvider] = useState("OKTA");
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            Settings
          </h1>
        </div>
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

      {/* Private Beta notice */}
      <div style={{
        background: "#FFFBEB",
        border: "1px solid #FCD34D",
        borderRadius: 10,
        padding: "14px 20px",
        marginBottom: 16,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}>
        <svg width="16" height="16" fill="none" stroke="#D97706" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: "#92400E" }}>
            SSO is in Private Beta
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: "#B45309", lineHeight: 1.55 }}>
            Save your IdP configuration here. Domain-based login routing will be activated by the Cascrow team within 1 business day after you save.
            Until then, team members continue to use password-based login.
            Contact <a href="mailto:support@cascrow.com" style={{ color: "#92400E", fontWeight: 600 }}>support@cascrow.com</a> to expedite setup.
          </p>
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
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>Configuration saved — activation pending</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#047857" }}>
              Provider: {PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider} · Domain: @{config.domain}
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

      {/* IdP Setup Instructions */}
      <div style={{ ...card, marginBottom: 0 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          Step 1 — Configure your Identity Provider
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.5 }}>
          {PROVIDER_DOCS[provider]?.guide}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {[
            { label: "ACS URL (Reply URL / Callback URL)", value: PROVIDER_DOCS[provider]?.acsUrl },
            { label: "Entity ID (Audience / SP Entity ID)", value: PROVIDER_DOCS[provider]?.entityId },
            { label: "Name ID Format", value: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" },
            { label: "Attribute mapping — email", value: "user.email" },
            { label: "Attribute mapping — name", value: "user.displayName" },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--ent-bg)",
              border: "1px solid var(--ent-border)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </span>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <code style={{ fontSize: 12.5, color: "var(--ent-text)", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</code>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(value ?? "").catch(() => {}); toast.success("Copied"); }}
                  style={{
                    flexShrink: 0,
                    background: "none",
                    border: "1px solid var(--ent-border)",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 11,
                    color: "var(--ent-muted)",
                    cursor: "pointer",
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: 12.5, color: "#1E40AF" }}>
          <strong>Step 2 — </strong>
          After configuring your IdP, copy the Connection ID / App ID back into the form above and click &quot;Save configuration&quot;.
          The Cascrow team will verify the SAML metadata and enable domain routing within 1 business day.
        </div>
      </div>

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
