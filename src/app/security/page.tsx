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
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 99,
    background: "#DCFCE7",
    color: "#15803D",
  } as React.CSSProperties,
};

function Check() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Row({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={s.card}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}><Check /></div>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: "#111827" }}>{title}</p>
          <p style={{ margin: 0, fontSize: 13.5, color: "#6B7280", lineHeight: 1.5 }}>{desc}</p>
        </div>
      </div>
    </div>
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
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
              Security & Trust Center
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 16, color: "#6B7280", lineHeight: 1.6, maxWidth: 580 }}>
            cascrow is built for enterprise-grade compliance reporting. Here's how we protect your data
            and guarantee the integrity of every attestation.
          </p>
        </div>

        {/* Data & Privacy */}
        <div style={s.section}>
          <h2 style={s.h2}>Data & Privacy</h2>
          <Row
            title="EU Data Residency"
            desc="All data is stored on EU-region servers (Neon PostgreSQL, Frankfurt). No data is processed or stored outside the European Union."
          />
          <Row
            title="GDPR Compliance"
            desc="Full GDPR compliance including the right to erasure, data portability, and purpose limitation. You can delete your account and all associated data at any time."
          />
          <Row
            title="Encryption at Rest"
            desc="All database content is encrypted at rest using AES-256. API keys and data source credentials are stored as hashes or AES-256-GCM encrypted ciphertext — never in plaintext."
          />
          <Row
            title="Encryption in Transit"
            desc="All connections are encrypted via TLS 1.2+. The platform is served exclusively over HTTPS with HSTS enforced."
          />
          <Row
            title="Minimal Data Collection"
            desc="We collect only what's necessary to provide the service. Evidence data fetched during attestation runs is stored in isolated Vercel Blob storage with access controls."
          />
        </div>

        {/* Immutability & Audit Trail */}
        <div style={s.section}>
          <h2 style={s.h2}>Immutability & Audit Trail</h2>
          <Row
            title="XRPL Blockchain Anchoring"
            desc="Every attestation run is cryptographically anchored to the XRP Ledger Mainnet via an AccountSet transaction with a JSON memo. Once written, it cannot be altered or deleted."
          />
          <Row
            title="Cryptographic Evidence Chain"
            desc="Each attestation result includes a SHA-256 chain linking the raw evidence, the AI prompt, and the AI response. Tamper-evident: any change breaks the chain."
          />
          <Row
            title="SHA-256 Content Hashing"
            desc="All fetched data sources are SHA-256 hashed before AI evaluation. The hash is stored on-chain so recipients can independently verify that the AI evaluated unmodified content."
          />
          <Row
            title="Signed Attestation Certificates"
            desc="Each verified milestone produces a timestamped PDF certificate with the XRPL transaction hash, AI verdict, and cryptographic evidence summary."
          />
          <Row
            title="Immutable Audit Log"
            desc="Every platform action (data source lock, attestation run, certificate generation) is appended to an immutable audit log anchored on-chain."
          />
        </div>

        {/* AI & Verification */}
        <div style={s.section}>
          <h2 style={s.h2}>AI Verification Integrity</h2>
          <Row
            title="Pre-Committed Data Sources"
            desc="Data sources are locked before the verification date. Once locked, neither the platform nor the customer can change what evidence the AI will evaluate."
          />
          <Row
            title="AI Vendor Independence"
            desc="Attestation uses a single Claude AI model for KPI evaluation, with independent regulatory mapping. No single vendor controls the entire verification decision."
          />
          <Row
            title="Human Auditor Override"
            desc="Every attestation can be reviewed and overridden by a designated external auditor. The auditor's identity and reasoning are recorded on-chain."
          />
          <Row
            title="SSRF & Injection Protection"
            desc="All user-provided URLs (data sources, webhooks) are validated against private IP ranges and DNS-rebinding attacks before any request is made."
          />
        </div>

        {/* Access & Authentication */}
        <div style={s.section}>
          <h2 style={s.h2}>Access & Authentication</h2>
          <Row
            title="Bcrypt Password Hashing"
            desc="Passwords are hashed with bcrypt (cost factor 12). Plaintext passwords are never stored or logged."
          />
          <Row
            title="Brute-Force Protection"
            desc="Login attempts are rate-limited and accounts are temporarily locked after repeated failures. Rate limits are enforced via Upstash Redis across all server instances."
          />
          <Row
            title="Email Verification"
            desc="All accounts require email verification before accessing the platform."
          />
          <Row
            title="Webhook Request Signing"
            desc="All outbound webhook deliveries are signed with HMAC-SHA256. Recipients can verify authenticity without trusting the transport layer."
          />
          <Row
            title="Sanctions Screening"
            desc="Enterprise users are screened against OFAC and EU consolidated sanctions lists. Sanctions status is rechecked daily."
          />
        </div>

        {/* Operations */}
        <div style={s.section}>
          <h2 style={s.h2}>Operations & Reliability</h2>
          <Row
            title="Error Monitoring (EU Region)"
            desc="Production errors are captured by Sentry hosted in the EU (Frankfurt). Error data never leaves the European region."
          />
          <Row
            title="Automated Backups"
            desc="The PostgreSQL database (Neon) is automatically backed up with point-in-time recovery. Vercel Blob provides geo-redundant storage for all uploaded files."
          />
          <Row
            title="No Secret Retrieval"
            desc="API keys, webhook signing secrets, and data source credentials are shown exactly once at creation. The platform stores only hashes — secrets cannot be retrieved after creation."
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
            For security disclosures or enterprise compliance questions, please contact us directly.
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
