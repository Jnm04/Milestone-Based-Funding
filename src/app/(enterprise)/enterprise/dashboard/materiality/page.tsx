"use client";

import { useState, useEffect } from "react";
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

type AssessmentSummary = {
  id: string;
  sector: string;
  status: string;
  createdAt: string;
  summary?: string | null;
};

export default function MaterialityLandingPage() {
  const router = useRouter();
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);

  useEffect(() => {
    fetch("/api/attestation/materiality")
      .then((r) => r.json())
      .then((data: AssessmentSummary[]) => Array.isArray(data) && setAssessments(data))
      .catch(() => {});
  }, []);

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
      router.push(`/enterprise/dashboard/materiality/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  const sectorLabel = (v: string) => SECTORS.find((s) => s.value === v)?.label ?? v;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Materiality Assessment
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ent-muted)" }}>
          EU CSRD double materiality — AI-powered ESRS mapping in ~5 minutes
        </p>
      </div>

      {/* Existing assessments */}
      {assessments.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ent-muted)" }}>
            Your Assessments
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {assessments.map((a) => (
              <Link
                key={a.id}
                href={`/enterprise/dashboard/materiality/${a.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "white",
                  border: "1px solid var(--ent-border)",
                  textDecoration: "none",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 99,
                    background: a.status === "COMPLETE" ? "#DCFCE7" : "#FEF9C3",
                    color: a.status === "COMPLETE" ? "#16a34a" : "#ca8a04",
                  }}>
                    {a.status === "COMPLETE" ? "Complete" : "In Progress"}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                      {sectorLabel(a.sector)}
                    </span>
                    {a.summary && (
                      <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--ent-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 380 }}>
                        {a.summary.replace(/\*\*/g, "").slice(0, 100)}…
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--ent-muted)" }}>
                    {new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span style={{ color: "var(--ent-accent)", fontSize: 14 }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Start new */}
      <div style={{ background: "white", border: "1px solid var(--ent-border)", borderRadius: 12, padding: "32px", maxWidth: 480 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px",
          borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", background: "#EFF6FF", color: "var(--ent-accent)",
          border: "1px solid #BFDBFE", marginBottom: 20,
        }}>
          CSRD / Phase 3
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--ent-text)" }}>
          Start New Assessment
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "var(--ent-muted)", lineHeight: 1.6 }}>
          Identify which ESG topics are material from both a financial and impact perspective. 12 questions · AI-powered.
        </p>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 6 }}>
            Company Sector
          </label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", fontSize: 13.5,
              border: "1px solid var(--ent-border)", borderRadius: 8,
              background: "var(--ent-bg)", color: "var(--ent-text)",
              outline: "none", boxSizing: "border-box", cursor: "pointer",
            }}
          >
            <option value="">Select your sector…</option>
            {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        {error && <p style={{ fontSize: 13, color: "#DC2626", marginBottom: 12 }}>{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading || !sector}
          style={{
            width: "100%", padding: "11px 0", borderRadius: 8, fontSize: 14,
            fontWeight: 600, color: "white",
            background: loading || !sector ? "#93C5FD" : "var(--ent-accent)",
            border: "none", cursor: loading || !sector ? "not-allowed" : "pointer",
            boxShadow: loading || !sector ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
          }}
        >
          {loading ? "Creating assessment…" : "Start Assessment →"}
        </button>
        <p style={{ fontSize: 12, textAlign: "center", marginTop: 12, color: "var(--ent-muted)" }}>
          12 questions · ~5 minutes · AI-powered ESRS mapping
        </p>
      </div>
    </div>
  );
}
