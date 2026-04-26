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
  { href: "/enterprise/dashboard/settings/audit-log", label: "Audit Log" },
];

const PROVIDERS = [
  {
    value: "OKTA",
    label: "Okta",
    logo: "🔑",
    desc: "Workforce identity for enterprises",
    guide: "In Okta: Applications → Create App Integration → SAML 2.0. Enter the values below in the 'Configure SAML' step.",
  },
  {
    value: "AZURE_AD",
    label: "Microsoft Entra ID",
    logo: "🪟",
    desc: "Azure Active Directory / Entra ID",
    guide: "In Azure Portal: Enterprise Applications → New application → Non-gallery. Enter the values below in 'Set up single sign-on'.",
  },
  {
    value: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    logo: "🔵",
    desc: "Google Workspace SAML App",
    guide: "In Google Admin: Apps → Web and mobile apps → Add custom SAML app. Enter the values below in the Service Provider Details step.",
  },
  {
    value: "SAML",
    label: "Generic SAML 2.0",
    logo: "🔐",
    desc: "Any SAML 2.0-compatible provider",
    guide: "Configure your SAML 2.0 identity provider with the Service Provider values below.",
  },
];

const SP_DETAILS = {
  acsUrl: "https://cascrow.com/api/auth/saml/callback",
  entityId: "https://cascrow.com",
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

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700,
      background: done ? "#059669" : active ? "var(--ent-accent)" : "var(--ent-bg)",
      color: done || active ? "white" : "var(--ent-muted)",
      border: done ? "none" : active ? "none" : "1px solid var(--ent-border)",
    }}>
      {done ? "✓" : n}
    </div>
  );
}

export default function SsoSettingsPage() {
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1 = choose provider, 2 = configure IdP, 3 = enter details
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
        setStep(3); // jump to review step if already configured
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
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setConfig(data.config);
      toast.success("SSO configuration saved — activation pending");
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
      setStep(1);
      toast.success("SSO configuration removed");
    } catch {
      toast.error("Failed to remove SSO configuration");
    } finally {
      setRemoving(false);
    }
  }

  const selectedProvider = PROVIDERS.find(p => p.value === provider)!;
  const steps = [
    { n: 1, label: "Choose provider" },
    { n: 2, label: "Configure your IdP" },
    { n: 3, label: "Enter details & save" },
  ];

  return (
    <div style={{ padding: "32px 36px", maxWidth: 720 }}>
      {/* Header + Tabs */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/sso";
            return (
              <a key={tab.href} href={tab.href} style={{
                padding: "8px 16px", fontSize: 13.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--ent-accent)" : "var(--ent-muted)",
                borderBottom: active ? "2px solid var(--ent-accent)" : "2px solid transparent",
                textDecoration: "none", marginBottom: -1, transition: "color 0.15s", whiteSpace: "nowrap",
              }}>
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Beta notice */}
      <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 10 }}>
        <svg width="16" height="16" fill="none" stroke="#D97706" strokeWidth={1.75} viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p style={{ margin: 0, fontSize: 12.5, color: "#B45309", lineHeight: 1.55 }}>
          <strong style={{ color: "#92400E" }}>SSO is in Private Beta.</strong>{" "}
          Save your configuration here — the Cascrow team will activate domain routing within 1 business day.
          Contact <a href="mailto:support@cascrow.com" style={{ color: "#92400E", fontWeight: 600 }}>support@cascrow.com</a> to expedite.
        </p>
      </div>

      {/* Active config banner */}
      {!loading && config && (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>Configuration saved — activation pending</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#047857" }}>
              Provider: {PROVIDERS.find((p) => p.value === config.provider)?.label ?? config.provider} · Domain: @{config.domain}
            </p>
          </div>
          <button onClick={handleRemove} disabled={removing} style={{
            background: "none", border: "1px solid #FECACA", color: removing ? "#FCA5A5" : "#DC2626",
            borderRadius: 7, padding: "6px 14px", fontSize: 12.5, fontWeight: 600, cursor: removing ? "not-allowed" : "pointer",
          }}>
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {/* Step progress indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
        {steps.map((s, idx) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : undefined }}>
            <button
              onClick={() => { if (s.n < step || (s.n === step + 1 && step === 1 && provider)) setStep(s.n); }}
              disabled={s.n > step + 1 || (s.n > 1 && !provider)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", cursor: s.n <= step ? "pointer" : "default",
                padding: "4px 0", opacity: s.n > step + 1 ? 0.4 : 1,
              }}
            >
              <StepBadge n={s.n} active={step === s.n} done={step > s.n} />
              <span style={{ fontSize: 13, fontWeight: step === s.n ? 700 : 500, color: step === s.n ? "var(--ent-text)" : "var(--ent-muted)", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: step > s.n ? "#059669" : "var(--ent-border)", margin: "0 12px" }} />
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: 60, borderRadius: 8, background: "var(--ent-bg)", opacity: 0.6 }} />)}
        </div>
      ) : (
        <>
          {/* ── Step 1: Choose Provider ── */}
          {step === 1 && (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Choose your identity provider</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
                Select the SSO system your organisation uses.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setProvider(p.value)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px",
                      borderRadius: 10, textAlign: "left", cursor: "pointer",
                      background: provider === p.value ? "#EFF6FF" : "white",
                      border: `2px solid ${provider === p.value ? "var(--ent-accent)" : "var(--ent-border)"}`,
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1 }}>{p.logo}</span>
                    <div>
                      <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 700, color: "var(--ent-text)" }}>{p.label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setStep(2)}
                  style={{ background: "var(--ent-accent)", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Configure your IdP ── */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
                Configure {selectedProvider.label} as your IdP
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.55 }}>
                {selectedProvider.guide}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "ACS URL (Reply URL / Callback URL)", value: SP_DETAILS.acsUrl },
                  { label: "Entity ID (Audience / SP Entity ID)", value: SP_DETAILS.entityId },
                  { label: "Name ID Format", value: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" },
                  { label: "Attribute — email", value: "user.email" },
                  { label: "Attribute — name", value: "user.displayName" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 14px", borderRadius: 8, background: "var(--ent-bg)", border: "1px solid var(--ent-border)" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <code style={{ fontSize: 12.5, color: "var(--ent-text)", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</code>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); toast.success("Copied"); }}
                        style={{ flexShrink: 0, background: "none", border: "1px solid var(--ent-border)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: "var(--ent-muted)", cursor: "pointer" }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: 12.5, color: "#1E40AF", marginBottom: 24, lineHeight: 1.55 }}>
                After entering these values in {selectedProvider.label}, it will give you a <strong>Connection ID / Application ID</strong>. Copy it — you&apos;ll need it in the next step.
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ background: "none", border: "1px solid var(--ent-border)", color: "var(--ent-muted)", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  style={{ background: "var(--ent-accent)", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
                >
                  I&apos;ve configured my IdP →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Enter connection details ── */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
                {config ? "Update your SSO configuration" : "Enter your connection details"}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
                Paste the Connection ID from {selectedProvider.label} and confirm your email domain.
              </p>

              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Provider (read-only recap) */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <span style={{ fontSize: 18 }}>{selectedProvider.logo}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>{selectedProvider.label}</p>
                    <button type="button" onClick={() => setStep(1)} style={{ fontSize: 12, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Change provider
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                    Connection ID / Application ID
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
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>The application or connection ID from your identity provider dashboard.</p>
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
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>Must match your account&apos;s email domain. Users with this domain are redirected to your IdP.</p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  {!config && (
                    <button type="button" onClick={() => setStep(2)} style={{ background: "none", border: "1px solid var(--ent-border)", color: "var(--ent-muted)", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                      ← Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      marginLeft: "auto",
                      background: saving ? "#93C5FD" : "var(--ent-accent)",
                      color: "white", border: "none", borderRadius: 8,
                      padding: "9px 24px", fontSize: 13.5, fontWeight: 600,
                      cursor: saving ? "not-allowed" : "pointer",
                      boxShadow: saving ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
                    }}
                  >
                    {saving ? "Saving…" : config ? "Update configuration" : "Save configuration"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
