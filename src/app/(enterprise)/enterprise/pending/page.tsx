import Link from "next/link";

export default function EnterprisePendingPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--ent-bg)" }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "#EFF6FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          color: "var(--ent-accent)",
        }}>
          <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Access pending activation
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, color: "var(--ent-muted)", lineHeight: 1.65 }}>
          Your enterprise account is being reviewed. Our team will activate your access within 48 hours and send you a confirmation email.
        </p>
        <p style={{ margin: "0 0 32px", fontSize: 14, color: "var(--ent-muted)" }}>
          Questions? Contact us at{" "}
          <a href="mailto:enterprise@cascrow.com" style={{ color: "var(--ent-accent)", textDecoration: "none", fontWeight: 500 }}>
            enterprise@cascrow.com
          </a>
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "10px 24px",
            borderRadius: 8,
            border: "1px solid var(--ent-border)",
            color: "var(--ent-text)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            background: "white",
          }}
        >
          Back to cascrow
        </Link>
      </div>
    </div>
  );
}
