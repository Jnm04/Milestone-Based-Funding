import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Security & Trust | Cascrow",
  description: "How cascrow protects your funds, data, and the integrity of every milestone.",
};

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const card    = "hsl(24 12% 6% / 0.5)";

function Check({ enterprise = false }: { enterprise?: boolean }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={enterprise ? "hsl(28 75% 70%)" : primary} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function Row({ title, desc, enterprise = false }: { title: string; desc: string; enterprise?: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl p-5" style={{ background: enterprise ? "hsl(28 18% 8% / 0.6)" : card, border: `1px solid ${enterprise ? "hsl(28 75% 70% / 0.15)" : border}`, marginBottom: 8 }}>
      <Check enterprise={enterprise} />
      <div>
        <p className="mb-1 font-medium text-sm" style={{ color: fg }}>{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: muted }}>{desc}</p>
      </div>
    </div>
  );
}

function SectionHead({ title, badge }: { title: string; badge: string }) {
  const isEnterprise = badge === "Enterprise";
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5 mt-14">
      <h2 className="text-lg font-semibold tracking-tight" style={{ color: fg }}>{title}</h2>
      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{
        background: isEnterprise ? "hsl(28 75% 70% / 0.12)" : "hsl(22 55% 54% / 0.12)",
        border: `1px solid ${isEnterprise ? "hsl(28 75% 70% / 0.3)" : "hsl(22 55% 54% / 0.3)"}`,
        color: isEnterprise ? "hsl(28 75% 70%)" : primary,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}>{badge}</span>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <div style={{ minHeight: "100vh", background: "hsl(24 14% 4%)", color: fg }}>
      <SiteNav activePage="Security" />

      <main className="container-tight pt-36 pb-24 max-w-3xl">
        {/* Hero */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${primary}, transparent)` }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: primary }}>Security & Trust</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-4" style={{ color: fg }}>How we protect you.</h1>
          <p className="text-lg max-w-xl" style={{ color: muted }}>
            How cascrow protects your funds, your data, and the integrity of every milestone — for all users and for Enterprise organisations.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 rounded-xl p-5 mb-4" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="flex items-center gap-2 text-sm">
            <Check />
            <span style={{ color: fg }}><strong className="font-medium">All users</strong> <span style={{ color: muted }}>— applies to every cascrow account</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check enterprise />
            <span style={{ color: fg }}><strong className="font-medium">Enterprise</strong> <span style={{ color: muted }}>— additional protections for Enterprise organisations</span></span>
          </div>
        </div>

        <SectionHead title="Data & Privacy" badge="All users" />
        <Row title="EU Database (Frankfurt)" desc="Account data, contracts, milestones, and proofs metadata are stored in Neon PostgreSQL hosted in the EU (Frankfurt region). Your personal data never leaves the European Union." />
        <Row title="GDPR Compliance" desc="Full GDPR compliance — including the right to erasure, data portability, and purpose limitation. You can delete your account and all associated data at any time from your profile settings." />
        <Row title="Encryption at Rest" desc="All database content is encrypted at rest using AES-256. API keys are stored only as SHA-256 hashes — the raw key is shown exactly once and cannot be retrieved." />
        <Row title="Encryption in Transit" desc="All connections use TLS 1.2+. The platform is served exclusively over HTTPS with HSTS enforced. No unencrypted communication is permitted." />
        <Row title="File Storage (Global CDN)" desc="Uploaded proof documents (PDFs) and NFT certificates are stored on Vercel Blob, a globally distributed CDN. File content is access-controlled and not publicly indexed." />
        <Row title="Error Monitoring — EU Region" desc="Production errors are captured by Sentry, with data processing and storage in Germany (Frankfurt). Error data never leaves the EU region." />
        <Row title="Analytics — EU Region" desc="Usage analytics are processed on EU-region servers. No analytics data is sent to US-based servers." />

        <SectionHead title="Escrow & Blockchain" badge="All users" />
        <Row title="Non-Custodial Smart Contract Escrow" desc="Funds are locked directly in the MilestoneFundEscrow smart contract on the XRPL EVM Sidechain. cascrow never holds your RLUSD — the contract releases funds only when the AI verdict is met or the investor cancels." />
        <Row title="Cryptographic Release Conditions" desc="Every milestone escrow uses a pre-committed cryptographic condition (keccak256 hash). The platform must reveal the matching fulfillment to release funds — the contract enforces this on-chain, not off-chain." />
        <Row title="XRPL Mainnet NFT Certificates" desc="Completed milestones produce a non-transferable NFT on the native XRP Ledger Mainnet. The certificate is permanent, publicly verifiable, and cannot be deleted or altered." />
        <Row title="On-Chain Audit Trail" desc="Every platform action is anchored to the XRP Ledger Mainnet via an AccountSet transaction with a JSON memo. Once written, it cannot be altered or deleted." />

        <SectionHead title="Authentication & Account Security" badge="All users" />
        <Row title="Bcrypt Password Hashing" desc="Passwords are hashed with bcrypt (cost factor 12). Plaintext passwords are never stored or logged anywhere in the system." />
        <Row title="Brute-Force Protection" desc="Login attempts are rate-limited via Upstash Redis across all server instances. Repeated failures trigger progressive delays. Admin login is separately rate-limited by IP." />
        <Row title="Email Verification" desc="All accounts require email verification before accessing the platform. Password reset links are single-use and expire after 1 hour." />
        <Row title="Session Management" desc="You can review recent sign-ins and sign out all active sessions at any time from your Profile → Security settings." />

        {/* Enterprise divider */}
        <div className="flex items-center gap-4 my-14">
          <div className="flex-1 h-px" style={{ background: "hsl(28 75% 70% / 0.2)" }} />
          <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: "hsl(28 75% 70% / 0.08)", border: "1px solid hsl(28 75% 70% / 0.2)", color: "hsl(28 75% 70%)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>Enterprise — additional protections</span>
          <div className="flex-1 h-px" style={{ background: "hsl(28 75% 70% / 0.2)" }} />
        </div>

        <SectionHead title="Identity & Access Management" badge="Enterprise" />
        <Row enterprise title="Single Sign-On (SSO)" desc="Connect your existing identity provider — Okta, Azure Active Directory, Google Workspace, or any SAML 2.0-compatible IdP. All team logins are governed by your organisation's access policies and MFA requirements." />
        <Row enterprise title="Role-Based Access Control" desc="Invite team members with granular roles (Admin, Editor, Viewer). Roles can be changed inline; pending invites are clearly separated from active members." />
        <Row enterprise title="API Key Management" desc="Generate up to 10 named API keys per organisation. Keys are shown once at creation and stored as SHA-256 hashes. Each key can be independently revoked without affecting others." />
        <Row enterprise title="Webhook Request Signing" desc="All outbound webhook deliveries are signed with HMAC-SHA256. Your endpoint can verify the signature independently, without trusting the transport layer." />

        <SectionHead title="Compliance & Audit" badge="Enterprise" />
        <Row enterprise title="Organisation Audit Log" desc="Every sensitive action — team member invites, role changes, SSO configuration, API key creation and deletion — is logged with actor, timestamp, and detail. The audit log is immutable and paginated for compliance review." />
        <Row enterprise title="Sanctions Screening" desc="Enterprise organisations are screened against OFAC and EU consolidated sanctions lists. Sanctions status is rechecked daily. Access is blocked automatically if a match is detected." />
        <Row enterprise title="5-Model AI Verification" desc="Milestone proof verification uses a majority vote across 5 independent AI models (Claude, Gemini, GPT-4o-mini, Mistral, Cerebras). A minimum of 3/5 YES verdicts is required for release." />
        <Row enterprise title="Human Auditor Override" desc="Every AI verification can be reviewed and overridden by a designated platform auditor. The override decision, actor identity, and reasoning are recorded in the on-chain audit trail." />
        <Row enterprise title="EU Data Residency" desc="Enterprise organisation data is stored in the same EU-region PostgreSQL database (Frankfurt) as all other cascrow data. No enterprise-specific data processing outside the EU." />

        {/* Contact */}
        <div className="gradient-border mt-14 rounded-2xl p-8" style={{ background: card, backdropFilter: "blur(12px)" }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: fg }}>Questions or a security concern?</h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: muted }}>
            For security disclosures, vulnerability reports, or enterprise compliance questions, contact us directly.
          </p>
          <a href="mailto:security@cascrow.com" className="inline-flex items-center rounded-full px-6 py-2.5 text-sm font-medium" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}>
            security@cascrow.com
          </a>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
