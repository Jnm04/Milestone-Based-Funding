"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SsoConfig {
  id: string;
  provider: string;
  connectionId: string;
  domain: string;
  clientId: string | null;
  clientSecretSet: boolean;
  issuerUrl: string | null;
  samlSsoUrl: string | null;
  samlCertificateSet: boolean;
  samlEntityId: string | null;
  createdAt: string;
  updatedAt: string;
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
    guide: "In Okta: Applications → Create App Integration → OIDC - Web Application. Copy the Client ID and Client Secret. The Issuer URL is your Okta domain (e.g. https://dev-xxx.okta.com).",
    type: "oidc",
  },
  {
    value: "AZURE_AD",
    label: "Microsoft Entra ID",
    logo: "🪟",
    desc: "Azure Active Directory / Entra ID",
    guide: "In Azure Portal: App registrations → New registration → Web redirect URI. After registering, copy the Application (client) ID. Create a client secret under Certificates & secrets. Issuer URL: https://login.microsoftonline.com/{tenant-id}/v2.0",
    type: "oidc",
  },
  {
    value: "GOOGLE_WORKSPACE",
    label: "Google Workspace",
    logo: "🔵",
    desc: "Google Workspace OIDC",
    guide: "In Google Cloud Console: APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application). Set redirect URI to https://cascrow.com/api/auth/sso/callback. Issuer URL: https://accounts.google.com",
    type: "oidc",
  },
  {
    value: "SAML",
    label: "Generic SAML 2.0",
    logo: "🔐",
    desc: "Any SAML 2.0-compatible provider",
    guide: "Configure your SAML 2.0 identity provider with the Service Provider values shown in step 2. Then paste the IdP SSO URL and certificate below.",
    type: "saml",
  },
];

const SP_DETAILS = {
  acsUrl: (typeof window !== "undefined" ? window.location.origin : "https://cascrow.com") + "/api/auth/saml/callback",
  entityId: "https://cascrow.com",
  oidcCallback: (typeof window !== "undefined" ? window.location.origin : "https://cascrow.com") + "/api/auth/sso/callback",
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

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 14px", borderRadius: 8, background: "var(--ent-bg)", border: "1px solid var(--ent-border)" }}>
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
  );
}

export default function SsoSettingsPage() {
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState("OKTA");
  const [domain, setDomain] = useState("");
  // OIDC fields
  const [issuerUrl, setIssuerUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  // SAML fields
  const [samlSsoUrl, setSamlSsoUrl] = useState("");
  const [samlCertificate, setSamlCertificate] = useState("");
  const [samlEntityId, setSamlEntityId] = useState("");

  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/enterprise/sso");
      const data = await res.json() as { config: SsoConfig | null };
      if (data.config) {
        setConfig(data.config);
        setProvider(data.config.provider);
        setDomain(data.config.domain);
        setIssuerUrl(data.config.issuerUrl ?? "");
        setClientId(data.config.clientId ?? "");
        setSamlSsoUrl(data.config.samlSsoUrl ?? "");
        setSamlEntityId(data.config.samlEntityId ?? "");
        setStep(3);
      }
    } catch {
      toast.error("Failed to load SSO configuration");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const selectedProvider = PROVIDERS.find(p => p.value === provider)!;
  const isOidc = selectedProvider.type === "oidc";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    if (isOidc && (!clientId.trim() || !issuerUrl.trim())) {
      toast.error("Client ID and Issuer URL are required");
      return;
    }
    if (!isOidc && !samlSsoUrl.trim()) {
      toast.error("SSO URL is required for SAML");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { provider, domain: domain.trim().toLowerCase() };
      if (isOidc) {
        body.issuerUrl = issuerUrl.trim();
        body.clientId = clientId.trim();
        if (clientSecret) body.clientSecret = clientSecret;
      } else {
        body.samlSsoUrl = samlSsoUrl.trim();
        if (samlCertificate) body.samlCertificate = samlCertificate.trim();
        if (samlEntityId) body.samlEntityId = samlEntityId.trim();
      }

      const res = await fetch("/api/enterprise/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { config?: SsoConfig; error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setConfig(data.config ?? null);
      setClientSecret("");
      setSamlCertificate("");
      toast.success("SSO configuration saved and active");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove SSO configuration? Users on this domain will be able to log in with passwords again.")) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/enterprise/sso", { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      setConfig(null);
      setClientId(""); setIssuerUrl(""); setClientSecret("");
      setSamlSsoUrl(""); setSamlCertificate(""); setSamlEntityId("");
      setDomain("");
      setStep(1);
      toast.success("SSO configuration removed");
    } catch {
      toast.error("Failed to remove SSO configuration");
    } finally {
      setRemoving(false);
    }
  }

  const steps = [
    { n: 1, label: "Choose provider" },
    { n: 2, label: "Configure your IdP" },
    { n: 3, label: "Enter credentials" },
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

      {/* Active config banner */}
      {!loading && config && (
        <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth={2} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#065F46" }}>SSO active</p>
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

      {/* Step progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
        {steps.map((s, idx) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : undefined }}>
            <button
              onClick={() => { if (s.n <= step) setStep(s.n); }}
              disabled={s.n > step}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "none", border: "none", cursor: s.n <= step ? "pointer" : "default",
                padding: "4px 0", opacity: s.n > step ? 0.4 : 1,
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

          {/* ── Step 2: Configure IdP ── */}
          {step === 2 && (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
                Configure {selectedProvider.label}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.55 }}>
                {selectedProvider.guide}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {isOidc ? (
                  <>
                    <CopyRow label="Redirect URI / Callback URL" value={SP_DETAILS.oidcCallback} />
                    <CopyRow label="Application type" value="Web application (server-side)" />
                  </>
                ) : (
                  <>
                    <CopyRow label="ACS URL (Assertion Consumer Service URL)" value={SP_DETAILS.acsUrl} />
                    <CopyRow label="Entity ID / Audience" value={SP_DETAILS.entityId} />
                    <CopyRow label="Name ID Format" value="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" />
                    <CopyRow label="Attribute mapping — email" value="user.email" />
                    <CopyRow label="Attribute mapping — displayName" value="user.displayName" />
                  </>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button onClick={() => setStep(1)} style={{ background: "none", border: "1px solid var(--ent-border)", color: "var(--ent-muted)", borderRadius: 8, padding: "9px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  ← Back
                </button>
                <button onClick={() => setStep(3)} style={{ background: "var(--ent-accent)", color: "white", border: "none", borderRadius: 8, padding: "10px 28px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                  I&apos;ve configured my IdP →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Enter credentials ── */}
          {step === 3 && (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
                {config ? "Update SSO configuration" : "Enter connection credentials"}
              </h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
                {isOidc
                  ? `Paste the credentials from ${selectedProvider.label}.`
                  : "Paste the IdP SSO URL and certificate from your SAML provider."}
              </p>

              <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Provider recap */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                  <span style={{ fontSize: 18 }}>{selectedProvider.logo}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>{selectedProvider.label}</p>
                    <button type="button" onClick={() => { setStep(1); }} style={{ fontSize: 12, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Change provider
                    </button>
                  </div>
                </div>

                {/* OIDC fields */}
                {isOidc && (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        Issuer URL <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="url"
                        value={issuerUrl}
                        onChange={e => setIssuerUrl(e.target.value)}
                        placeholder={
                          provider === "OKTA" ? "https://dev-xxxxx.okta.com" :
                          provider === "AZURE_AD" ? "https://login.microsoftonline.com/{tenant-id}/v2.0" :
                          "https://accounts.google.com"
                        }
                        required
                        style={input}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                      />
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>The base URL of your identity provider.</p>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        Client ID <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={clientId}
                        onChange={e => setClientId(e.target.value)}
                        placeholder="0oa5nm3…"
                        required
                        style={input}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        Client Secret {config?.clientSecretSet ? <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>(leave blank to keep existing)</span> : <span style={{ color: "#DC2626" }}>*</span>}
                      </label>
                      <input
                        type="password"
                        value={clientSecret}
                        onChange={e => setClientSecret(e.target.value)}
                        placeholder={config?.clientSecretSet ? "●●●●●●●●" : "Enter client secret"}
                        required={!config?.clientSecretSet}
                        style={input}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                        autoComplete="new-password"
                      />
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>Stored encrypted. Never shown after saving.</p>
                    </div>
                  </>
                )}

                {/* SAML fields */}
                {!isOidc && (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        IdP SSO URL <span style={{ color: "#DC2626" }}>*</span>
                      </label>
                      <input
                        type="url"
                        value={samlSsoUrl}
                        onChange={e => setSamlSsoUrl(e.target.value)}
                        placeholder="https://idp.example.com/sso/saml"
                        required
                        style={input}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                      />
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>The SAML 2.0 SSO / Redirect endpoint from your IdP.</p>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        IdP Certificate {config?.samlCertificateSet ? <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>(leave blank to keep existing)</span> : <span style={{ color: "#DC2626" }}>*</span>}
                      </label>
                      <textarea
                        value={samlCertificate}
                        onChange={e => setSamlCertificate(e.target.value)}
                        placeholder="Paste the base64-encoded certificate (without -----BEGIN CERTIFICATE----- header/footer)"
                        required={!config?.samlCertificateSet}
                        rows={5}
                        style={{ ...input, fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                      />
                      <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>X.509 signing certificate from your IdP metadata. Stored encrypted.</p>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                        IdP Entity ID <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={samlEntityId}
                        onChange={e => setSamlEntityId(e.target.value)}
                        placeholder="https://idp.example.com"
                        style={input}
                        onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                        onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                      />
                    </div>
                  </>
                )}

                {/* Email domain */}
                <div>
                  <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                    Email Domain <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="company.com"
                    required
                    style={input}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                    onBlur={e => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                  />
                  <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                    Users with this email domain will be redirected to your IdP at login. Must match your account email domain.
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                    {saving ? "Saving…" : config ? "Update configuration" : "Save & activate SSO"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}

      <style>{`
        input:focus, select:focus, textarea:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
