import Link from "next/link";

const s = {
  section: { marginBottom: 56 } as React.CSSProperties,
  h2: { fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 16, marginTop: 0 } as React.CSSProperties,
  card: {
    background: "white",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 12,
  } as React.CSSProperties,
  cardEnterprise: {
    background: "#FFFBF5",
    border: "1px solid #FDE68A",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 12,
  } as React.CSSProperties,
};

function Check({ enterprise = false }: { enterprise?: boolean }) {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={enterprise ? "#B45309" : "#16A34A"} strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Row({ title, desc, enterprise = false }: { title: string; desc: string; enterprise?: boolean }) {
  return (
    <div style={enterprise ? s.cardEnterprise : s.card}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <Check enterprise={enterprise} />
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: "#111827" }}>{title}</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6B7280", lineHeight: 1.5 }}>{desc}</p>
        </div>
      </div>
    </div>
  );
}

function TierBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "4px 12px",
      borderRadius: 99,
      background: bg,
      color,
    }}>
      {label}
    </span>
  );
}

export default function SecurityPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid #E5E7EB", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: "#1E293B", letterSpacing: "-0.04em" }}>cascrow</span>
        </Link>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span style={{ fontSize: 14, color: "#6B7280" }}>Security & Trust</span>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 56 }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 34, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Security & Trust Center
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "#6B7280", lineHeight: 1.6, maxWidth: 580 }}>
            How cascrow protects your funds, your data, and the integrity of every milestone — for all users and for Enterprise organisations.
          </p>
        </div>

        {/* Legend */}
        <div style={{
          display: "flex",
          gap: 20,
          marginBottom: 48,
          padding: "16px 20px",
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Check />
            <span style={{ fontSize: 13, color: "#374151" }}>
              <strong>All users</strong> — applies to every cascrow account
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Check enterprise />
            <span style={{ fontSize: 13, color: "#374151" }}>
              <strong>Enterprise</strong> — additional protections for Enterprise organisations
            </span>
          </div>
        </div>

        {/* ── SECTION: Data & Privacy (All users) ─────────────── */}
        <div style={s.section}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, marginBottom: 0 }}>Data & Privacy</h2>
            <TierBadge label="All users" color="#15803D" bg="#DCFCE7" />
          </div>

          <Row
            title="EU Database (Frankfurt)"
            desc="Account data, contracts, milestones, and proofs metadata are stored in Neon PostgreSQL hosted in the EU (Frankfurt region). Your personal data never leaves the European Union."
          />
          <Row
            title="GDPR Compliance"
            desc="Full GDPR compliance — including the right to erasure, data portability, and purpose limitation. You can delete your account and all associated data at any time from your profile settings."
          />
          <Row
            title="Encryption at Rest"
            desc="All database content is encrypted at rest using AES-256. API keys are stored only as SHA-256 hashes — the raw key is shown exactly once and cannot be retrieved."
          />
          <Row
            title="Encryption in Transit"
            desc="All connections use TLS 1.2+. The platform is served exclusively over HTTPS with HSTS enforced. No unencrypted communication is permitted."
          />
          <Row
            title="File Storage (Global CDN)"
            desc="Uploaded proof documents (PDFs) and NFT certificates are stored on Vercel Blob, a globally distributed CDN. File content is access-controlled and not publicly indexed. Note: file data is not restricted to EU servers."
          />
          <Row
            title="Error Monitoring — EU Region"
            desc="Production errors are captured by Sentry, with data processing and storage in Germany (Frankfurt). Error data never leaves the EU region."
          />
          <Row
            title="Analytics — EU Region"
            desc="Usage analytics are processed by PostHog on EU-region servers (eu.posthog.com). No analytics data is sent to US-based servers."
          />
        </div>

        {/* ── SECTION: Escrow & Blockchain (All users) ─────────── */}
        <div style={s.section}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, marginBottom: 0 }}>Escrow & Blockchain</h2>
            <TierBadge label="All users" color="#15803D" bg="#DCFCE7" />
          </div>

          <Row
            title="Non-Custodial Smart Contract Escrow"
            desc="Funds are locked directly in the MilestoneFundEscrow smart contract on the XRPL EVM Sidechain. cascrow never holds your RLUSD — the contract releases funds only when the AI verdict is met or the investor cancels."
          />
          <Row
            title="Cryptographic Release Conditions"
            desc="Every milestone escrow uses a pre-committed cryptographic condition (keccak256 hash). The platform must reveal the matching fulfillment to release funds — the contract enforces this on-chain, not off-chain."
          />
          <Row
            title="XRPL Mainnet NFT Certificates"
            desc="Completed milestones produce a non-transferable NFT on the native XRP Ledger Mainnet. The certificate is permanent, publicly verifiable, and cannot be deleted or altered."
          />
          <Row
            title="On-Chain Audit Trail"
            desc="Every platform action is anchored to the XRP Ledger Mainnet via an AccountSet transaction with a JSON memo. Once written, it cannot be altered or deleted."
          />
        </div>

        {/* ── SECTION: Authentication (All users) ──────────────── */}
        <div style={s.section}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, marginBottom: 0 }}>Authentication & Account Security</h2>
            <TierBadge label="All users" color="#15803D" bg="#DCFCE7" />
          </div>

          <Row
            title="Bcrypt Password Hashing"
            desc="Passwords are hashed with bcrypt (cost factor 12). Plaintext passwords are never stored or logged anywhere in the system."
          />
          <Row
            title="Brute-Force Protection"
            desc="Login attempts are rate-limited via Upstash Redis across all server instances. Repeated failures trigger progressive delays. Admin login is separately rate-limited by IP."
          />
          <Row
            title="Email Verification"
            desc="All accounts require email verification before accessing the platform. Password reset links are single-use and expire after 1 hour."
          />
          <Row
            title="Session Management"
            desc="You can review recent sign-ins and sign out all active sessions at any time from your Profile → Security settings. Session invalidation takes effect immediately across all devices."
          />
        </div>

        {/* ── DIVIDER ───────────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          margin: "0 0 48px",
        }}>
          <div style={{ flex: 1, height: 1, background: "#FDE68A" }} />
          <TierBadge label="Enterprise — additional protections" color="#B45309" bg="#FEF3C7" />
          <div style={{ flex: 1, height: 1, background: "#FDE68A" }} />
        </div>

        {/* ── SECTION: Enterprise Identity & Access ────────────── */}
        <div style={s.section}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, marginBottom: 0 }}>Identity & Access Management</h2>
            <TierBadge label="Enterprise" color="#B45309" bg="#FEF3C7" />
          </div>

          <Row
            enterprise
            title="Single Sign-On (SSO)"
            desc="Connect your existing identity provider — Okta, Azure Active Directory, Google Workspace, or any SAML 2.0-compatible IdP. All team logins are governed by your organisation's access policies and MFA requirements."
          />
          <Row
            enterprise
            title="Role-Based Access Control"
            desc="Invite team members with granular roles (Admin, Editor, Viewer). Roles can be changed inline; pending invites are clearly separated from active members. Only the organisation owner can manage team membership."
          />
          <Row
            enterprise
            title="API Key Management"
            desc="Generate up to 10 named API keys per organisation. Keys are shown once at creation and stored as SHA-256 hashes. Each key can be independently revoked without affecting others."
          />
          <Row
            enterprise
            title="Webhook Request Signing"
            desc="All outbound webhook deliveries are signed with HMAC-SHA256. Your endpoint can verify the signature independently, without trusting the transport layer."
          />
        </div>

        {/* ── SECTION: Enterprise Compliance & Audit ───────────── */}
        <div style={s.section}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h2 style={{ ...s.h2, marginBottom: 0 }}>Compliance & Audit</h2>
            <TierBadge label="Enterprise" color="#B45309" bg="#FEF3C7" />
          </div>

          <Row
            enterprise
            title="Organisation Audit Log"
            desc="Every sensitive action — team member invites, role changes, SSO configuration, API key creation and deletion — is logged with actor, timestamp, and detail. The audit log is immutable and paginated for compliance review."
          />
          <Row
            enterprise
            title="Sanctions Screening"
            desc="Enterprise organisations are screened against OFAC and EU consolidated sanctions lists. Sanctions status is rechecked daily. Access is blocked automatically if a match is detected."
          />
          <Row
            enterprise
            title="5-Model AI Verification"
            desc="Milestone proof verification uses a majority vote across 5 independent AI models (Claude, Gemini, GPT-4o-mini, Mistral, Cerebras). A minimum of 3/5 YES verdicts is required for release. No single AI vendor controls the outcome."
          />
          <Row
            enterprise
            title="Human Auditor Override"
            desc="Every AI verification can be reviewed and overridden by a designated platform auditor. The override decision, actor identity, and reasoning are recorded in the on-chain audit trail."
          />
          <Row
            enterprise
            title="EU Data Residency — Same Guarantee"
            desc="Enterprise organisation data (team members, audit logs, SSO config, API keys) is stored in the same EU-region PostgreSQL database (Frankfurt) as all other cascrow data. No enterprise-specific data processing outside the EU."
          />
        </div>

        {/* Contact */}
        <div style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: 12,
          padding: "24px",
        }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#1E40AF" }}>Questions or a security concern?</h2>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#1D4ED8", lineHeight: 1.5 }}>
            For security disclosures, vulnerability reports, or enterprise compliance questions, contact us directly.
          </p>
          <a
            href="mailto:security@cascrow.com"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#2563EB",
              color: "white",
              padding: "10px 20px",
              borderRadius: 7,
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            security@cascrow.com
          </a>
        </div>

      </div>
    </div>
  );
}
