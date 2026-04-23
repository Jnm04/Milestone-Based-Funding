"use client";

import { useState } from "react";
import Link from "next/link";

const USE_CASES = [
  { value: "CSRD", label: "CSRD / ESG Reporting" },
  { value: "KPI", label: "KPI & Revenue Attestation" },
  { value: "COMPLIANCE", label: "Group-wide Compliance Tracking" },
  { value: "OTHER", label: "Other" },
];

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Pre-committed data sources",
    desc: "Define where verification data comes from before the deadline. The platform fetches it autonomously — no opportunity to manipulate what the AI sees.",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: "On-chain audit trail",
    desc: "Every verification is hashed and written to the XRP Ledger. Auditors can independently verify the result — no trust in cascrow required.",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Attestation certificate",
    desc: "A formal, shareable PDF document with AI verdict, evidence hash, and blockchain transaction link. Ready for regulators, board members, and auditors.",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    title: "5-model AI majority vote",
    desc: "Claude, GPT-4o, Gemini, Mistral, and Cerebras evaluate the evidence independently. 3 of 5 must agree. No single model decides your compliance status.",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    title: "Recurring schedules",
    desc: "Set monthly, quarterly, or annual verification cycles. The platform runs automatically on schedule — no manual trigger required.",
  },
  {
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    title: "Auditor read-only access",
    desc: "Invite external auditors or board observers. They see results and certificates — not your API keys or internal data.",
  },
];

const USE_CASE_EXAMPLES = [
  {
    tag: "CSRD / ESG",
    title: "Scope 2 emissions reduced by 15%",
    steps: ["Annual sustainability PDF uploaded", "AI extracts emissions data", "Cross-referenced against 2024 baseline", "Certificate issued, XRPL hash stored"],
  },
  {
    tag: "KPI Attestation",
    title: "Q2 revenue ≥ €5M",
    steps: ["Stripe API endpoint pre-committed", "Platform calls API at deadline", "AI extracts and verifies total", "Tamper-proof record on-chain"],
  },
  {
    tag: "Group Compliance",
    title: "All 12 subsidiaries hold valid ISO 27001",
    steps: ["12 ISO registry URLs pre-committed", "Platform scrapes all pages at verification date", "AI confirms certificate validity and expiry", "One attestation entry per subsidiary"],
  },
];

export default function EnterprisePage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", useCase: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/enterprise/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div style={{ background: "var(--ent-bg)", minHeight: "100vh" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--ent-border)", background: "white" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#1D4ED8" />
              <path d="M8 14c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="14" r="2" fill="white" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
              cascrow <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>Enterprise</span>
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              Back to cascrow
            </Link>
            <a
              href="#request-access"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "white",
                background: "var(--ent-accent)",
                padding: "0.5rem 1.125rem",
                borderRadius: "6px",
              }}
              className="hover:opacity-90 transition-opacity"
            >
              Request access
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-8"
            style={{ background: "#EFF6FF", color: "var(--ent-accent)", border: "1px solid #BFDBFE" }}
          >
            Early Access
          </div>
          <h1
            className="text-5xl md:text-6xl leading-tight mb-6"
            style={{ fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.03em" }}
          >
            Corporate KPIs.<br />
            AI-verified.<br />
            <span style={{ color: "var(--ent-accent)" }}>Blockchain-secured.</span>
          </h1>
          <p className="text-xl mb-10 max-w-xl" style={{ color: "var(--ent-muted)", lineHeight: 1.7 }}>
            Define your goals. Pre-commit the evidence source. At the deadline, cascrow fetches the data autonomously, runs a 5-model AI vote, and writes an immutable attestation to the XRP Ledger.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#request-access"
              style={{
                fontWeight: 600,
                fontSize: "0.9375rem",
                color: "white",
                background: "var(--ent-accent)",
                padding: "0.75rem 1.75rem",
                borderRadius: "8px",
              }}
              className="hover:opacity-90 transition-opacity"
            >
              Request early access
            </a>
            <a
              href="#how-it-works"
              style={{
                fontWeight: 500,
                fontSize: "0.9375rem",
                color: "var(--ent-text)",
                background: "white",
                padding: "0.75rem 1.75rem",
                borderRadius: "8px",
                border: "1px solid var(--ent-border)",
              }}
              className="hover:border-slate-400 transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <div style={{ background: "white", borderTop: "1px solid var(--ent-border)", borderBottom: "1px solid var(--ent-border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-3">
          {[
            "No financial license required",
            "CSRD / ESRS compatible",
            "Auditor-accessible certificates",
            "XRP Ledger on-chain record",
            "No custody of funds",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2" style={{ fontSize: "0.8125rem", color: "var(--ent-muted)" }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--ent-success)", flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ent-accent)" }}>Platform</p>
          <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            Built for enterprise-grade accountability
          </h2>
          <p className="text-base max-w-xl" style={{ color: "var(--ent-muted)", lineHeight: 1.7 }}>
            Unlike file uploads or screenshots, cascrow&apos;s data connectors fetch evidence autonomously from pre-committed sources. The company has no opportunity to manipulate what the AI evaluates.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-xl"
              style={{ background: "white", border: "1px solid var(--ent-border)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                style={{ background: "#EFF6FF", color: "var(--ent-accent)" }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold mb-2" style={{ fontSize: "0.9375rem", color: "var(--ent-text)" }}>{f.title}</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--ent-muted)", lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ background: "white", borderTop: "1px solid var(--ent-border)", borderBottom: "1px solid var(--ent-border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ent-accent)" }}>Use cases</p>
            <h2 className="text-3xl font-bold" style={{ color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
              From goal to verified record in four steps
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {USE_CASE_EXAMPLES.map((uc) => (
              <div key={uc.tag}>
                <div
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold mb-4"
                  style={{ background: "#EFF6FF", color: "var(--ent-accent)" }}
                >
                  {uc.tag}
                </div>
                <h3 className="font-semibold mb-5 text-base" style={{ color: "var(--ent-text)" }}>
                  &ldquo;{uc.title}&rdquo;
                </h3>
                <ol className="space-y-3">
                  {uc.steps.map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                        style={{ background: "var(--ent-accent)", color: "white" }}
                      >
                        {i + 1}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "var(--ent-muted)", lineHeight: 1.6 }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section id="request-access" className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ent-accent)" }}>Early Access</p>
            <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
              Request access
            </h2>
            <p style={{ color: "var(--ent-muted)", lineHeight: 1.7 }}>
              We&apos;re onboarding a small number of design partners before public launch. Tell us about your use case and we&apos;ll be in touch within 48 hours.
            </p>
          </div>

          {status === "success" ? (
            <div
              className="text-center p-12 rounded-2xl"
              style={{ background: "white", border: "1px solid var(--ent-border)" }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
                style={{ background: "#ECFDF5", color: "var(--ent-success)" }}
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--ent-text)" }}>We received your request</h3>
              <p style={{ color: "var(--ent-muted)", fontSize: "0.9375rem" }}>
                Expect a reply from our team within 48 hours.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-8 rounded-2xl space-y-5"
              style={{ background: "white", border: "1px solid var(--ent-border)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>Full name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                    style={{
                      border: "1px solid var(--ent-border)",
                      background: "var(--ent-bg)",
                      color: "var(--ent-text)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>Work email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@company.com"
                    className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                    style={{
                      border: "1px solid var(--ent-border)",
                      background: "var(--ent-bg)",
                      color: "var(--ent-text)",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>Company</label>
                <input
                  type="text"
                  required
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="Acme GmbH"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    border: "1px solid var(--ent-border)",
                    background: "var(--ent-bg)",
                    color: "var(--ent-text)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>Primary use case</label>
                <select
                  required
                  value={form.useCase}
                  onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    border: "1px solid var(--ent-border)",
                    background: "var(--ent-bg)",
                    color: form.useCase ? "var(--ent-text)" : "var(--ent-muted)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                >
                  <option value="" disabled>Select a use case…</option>
                  {USE_CASES.map((uc) => (
                    <option key={uc.value} value={uc.value}>{uc.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>
                  Tell us more <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  rows={3}
                  placeholder="What KPIs or compliance requirements are you looking to attest? Any specific deadlines or frameworks (CSRD, GRI, UN SDGs)?"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-colors resize-none"
                  style={{
                    border: "1px solid var(--ent-border)",
                    background: "var(--ent-bg)",
                    color: "var(--ent-text)",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                />
              </div>

              {status === "error" && (
                <p className="text-sm" style={{ color: "#DC2626" }}>{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity"
                style={{
                  background: "var(--ent-accent)",
                  color: "white",
                  opacity: status === "loading" ? 0.7 : 1,
                }}
              >
                {status === "loading" ? "Sending…" : "Request early access"}
              </button>

              <p className="text-xs text-center" style={{ color: "var(--ent-muted)" }}>
                No spam. We reply personally within 48 hours.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--ent-border)", background: "white" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <span style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }}>
            © 2026 cascrow. All rights reserved.
          </span>
          <div className="flex items-center gap-6">
            <Link href="/terms" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              Terms
            </Link>
            <Link href="/avv" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              DPA / AVV
            </Link>
            <Link href="/datenschutz" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              Privacy
            </Link>
            <Link href="/risiken" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              Risk Disclosure
            </Link>
            <Link href="/" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }} className="hover:opacity-80 transition-opacity">
              cascrow.com
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
