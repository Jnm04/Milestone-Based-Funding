"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const SECTORS = [
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "TECH",          label: "Technology" },
  { value: "FINANCE",       label: "Finance & Banking" },
  { value: "ENERGY",        label: "Energy & Utilities" },
  { value: "HEALTHCARE",    label: "Healthcare" },
  { value: "RETAIL",        label: "Retail & Consumer" },
  { value: "OTHER",         label: "Other" },
];

export default function MaterialityLandingPage() {
  const router = useRouter();
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (!sector) { setError("Please select a sector."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/attestation/materiality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create assessment");
      const { id } = await res.json() as { id: string };
      router.push(`/enterprise/materiality/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--ent-bg)", minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid var(--ent-border)", background: "white" }}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/enterprise" style={{ fontWeight: 700, color: "var(--ent-text)" }}>
            cascrow <span style={{ color: "var(--ent-muted)", fontWeight: 400 }}>Enterprise</span>
          </Link>
          <Link href="/enterprise/dashboard" style={{ fontSize: "0.875rem", color: "var(--ent-muted)" }}>
            Dashboard →
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: "#EFF6FF", color: "var(--ent-accent)", border: "1px solid #BFDBFE" }}>
            CSRD / Phase 3
          </div>
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
            Double Materiality Assessment
          </h1>
          <p className="text-lg" style={{ color: "var(--ent-muted)", lineHeight: 1.7 }}>
            EU CSRD requires every reporting company to identify which ESG topics are material from both a financial and impact perspective.
            cascrow automates this assessment in minutes and links the output directly to blockchain-verified attestation milestones.
          </p>
        </div>

        <div className="max-w-md mx-auto p-8 rounded-2xl" style={{ background: "white", border: "1px solid var(--ent-border)" }}>
          <h2 className="font-semibold mb-6" style={{ color: "var(--ent-text)" }}>Start New Assessment</h2>

          <div className="mb-5">
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ent-text)" }}>
              Company Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
              style={{ border: "1px solid var(--ent-border)", background: "var(--ent-bg)", color: "var(--ent-text)" }}
            >
              <option value="">Select your sector…</option>
              {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

          <button
            onClick={handleStart}
            disabled={loading || !sector}
            className="w-full py-3 rounded-lg font-semibold text-sm text-white transition-opacity"
            style={{ background: "var(--ent-accent)", opacity: loading || !sector ? 0.6 : 1 }}
          >
            {loading ? "Creating assessment…" : "Start Assessment →"}
          </button>

          <p className="text-xs text-center mt-4" style={{ color: "var(--ent-muted)" }}>
            12 questions · ~5 minutes · AI-powered ESRS mapping
          </p>
        </div>
      </main>
    </div>
  );
}
