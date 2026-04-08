"use client";

import { useEffect, useState } from "react";

interface Stats {
  trainingCount: number;
  pendingReviewCount: number;
  embeddingCount: number;
  labelBreakdown: Record<string, number>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: "#EDE6DD" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#A89B8C", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function InternalDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem("cascrow_internal_key") ?? "";
    fetch("/api/internal/stats", { headers: { "x-internal-key": key } })
      .then((r) => {
        if (!r.ok) throw new Error("Unauthorized");
        return r.json();
      })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return <p style={{ color: "#ef4444" }}>Invalid key — please log out and try again.</p>;
  if (!stats) return <p style={{ color: "#A89B8C" }}>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 4 }}>Brain Dashboard</h1>
        <p style={{ color: "#A89B8C", fontSize: 14 }}>Training data and model improvement overview.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Training Entries" value={stats.trainingCount} sub="Labeled examples in dataset" />
        <StatCard label="Pending Review" value={stats.pendingReviewCount} sub="3-2 splits awaiting human label" />
        <StatCard label="Embeddings" value={stats.embeddingCount} sub="Proofs indexed for RAG" />
        <StatCard label="APPROVED" value={stats.labelBreakdown.APPROVED ?? 0} sub="of training entries" />
        <StatCard label="REJECTED" value={stats.labelBreakdown.REJECTED ?? 0} sub="of training entries" />
        <StatCard label="FAKED" value={stats.labelBreakdown.FAKED ?? 0} sub="fraud-flagged entries" />
      </div>

      <div style={{ padding: 20, background: "rgba(196,112,75,0.05)", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 12 }}>
        <p style={{ fontSize: 13, color: "#A89B8C", margin: 0 }}>
          {stats.pendingReviewCount > 0
            ? `⚠ ${stats.pendingReviewCount} entries need manual review — go to Review Queue.`
            : "✓ No pending reviews. All 3-2 splits have been labeled."}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          { href: "/internal/review", title: "Review Queue", desc: "Label 3-2 split decisions and flag fraud" },
          { href: "/internal/sandbox", title: "Sandbox", desc: "Test milestone/proof pairs without real contracts" },
          { href: "/internal/dataset", title: "Dataset", desc: "Browse all labeled training entries" },
        ].map(({ href, title, desc }) => (
          <a key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.15)")}
            >
              <div style={{ fontSize: 15, color: "#EDE6DD", marginBottom: 6 }}>{title} →</div>
              <div style={{ fontSize: 13, color: "#A89B8C" }}>{desc}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
