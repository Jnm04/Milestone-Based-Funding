"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface Stats {
  trainingCount: number;
  pendingReviewCount: number;
  embeddingCount: number;
  labelBreakdown: Record<string, number>;
  consensusBreakdown: { consensus: string; count: number }[];
  timeSeries: { date: string; total: number; approved: number; rejected: number; faked: number }[];
}

const COLORS = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED: "#f97316",
};

const CHART_STYLE = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(196,112,75,0.15)",
  borderRadius: 12,
  padding: 20,
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ padding: "20px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: "#A89B8C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: "#EDE6DD" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#A89B8C", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e1a18", border: "1px solid rgba(196,112,75,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
      {label && <div style={{ color: "#A89B8C", marginBottom: 6 }}>{label}</div>}
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function InternalDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const key = sessionStorage.getItem("cascrow_internal_key") ?? "";
    fetch("/api/internal/stats", { headers: { "x-internal-key": key } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return <p style={{ color: "#ef4444" }}>Invalid key — please log out and try again.</p>;
  if (!stats) return <p style={{ color: "#A89B8C" }}>Loading…</p>;

  const pieData = Object.entries(stats.labelBreakdown)
    .map(([name, value]) => ({ name, value }))
    .filter((d) => d.value > 0);

  const hasTimeSeries = stats.timeSeries.length > 0;
  const hasConsensus = stats.consensusBreakdown.length > 0;
  const hasPie = pieData.length > 0;
  const hasAnyChart = hasTimeSeries || hasConsensus || hasPie;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 300, marginBottom: 4 }}>Brain Dashboard</h1>
        <p style={{ color: "#A89B8C", fontSize: 14 }}>Training data and model improvement overview.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard label="Training Entries" value={stats.trainingCount} sub="Labeled examples in dataset" />
        <StatCard label="Pending Review" value={stats.pendingReviewCount} sub="3-2 splits awaiting human label" />
        <StatCard label="Embeddings" value={stats.embeddingCount} sub="Proofs indexed for RAG" />
        <StatCard label="Approved" value={stats.labelBreakdown.APPROVED ?? 0} sub="of training entries" />
        <StatCard label="Rejected" value={stats.labelBreakdown.REJECTED ?? 0} sub="of training entries" />
        <StatCard label="Faked" value={stats.labelBreakdown.FAKED ?? 0} sub="fraud-flagged entries" />
      </div>

      {/* Charts — only shown once there's data */}
      {hasAnyChart ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Time series — full width */}
          {hasTimeSeries && (
            <div style={CHART_STYLE}>
              <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500, marginBottom: 4 }}>Dataset growth (last 90 days)</div>
              <div style={{ fontSize: 12, color: "#A89B8C", marginBottom: 20 }}>New labeled entries per day</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={stats.timeSeries} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gRejected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gFaked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,112,75,0.08)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A89B8C" }} tickLine={false} axisLine={false}
                    tickFormatter={(d) => d.slice(5)} // show MM-DD only
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#A89B8C" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#A89B8C", paddingTop: 12 }} />
                  <Area type="monotone" dataKey="approved" name="Approved" stroke="#22c55e" strokeWidth={1.5} fill="url(#gApproved)" />
                  <Area type="monotone" dataKey="rejected" name="Rejected" stroke="#ef4444" strokeWidth={1.5} fill="url(#gRejected)" />
                  <Area type="monotone" dataKey="faked" name="Faked" stroke="#f97316" strokeWidth={1.5} fill="url(#gFaked)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bottom row: pie + bar */}
          <div style={{ display: "grid", gridTemplateColumns: hasPie && hasConsensus ? "1fr 1fr" : "1fr", gap: 20 }}>

            {/* Label distribution pie */}
            {hasPie && (
              <div style={CHART_STYLE}>
                <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500, marginBottom: 4 }}>Label distribution</div>
                <div style={{ fontSize: 12, color: "#A89B8C", marginBottom: 16 }}>Share of approved / rejected / faked</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={3}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS] ?? "#A89B8C"} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Consensus level bar chart */}
            {hasConsensus && (
              <div style={CHART_STYLE}>
                <div style={{ fontSize: 13, color: "#EDE6DD", fontWeight: 500, marginBottom: 4 }}>Consensus distribution</div>
                <div style={{ fontSize: 12, color: "#A89B8C", marginBottom: 16 }}>How many models agreed per decision</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.consensusBreakdown} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(196,112,75,0.08)" vertical={false} />
                    <XAxis dataKey="consensus" tick={{ fontSize: 11, fill: "#A89B8C" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#A89B8C" }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Entries" radius={[4, 4, 0, 0]}>
                      {stats.consensusBreakdown.map((entry) => {
                        const level = parseInt(entry.consensus);
                        const color = level >= 4 ? "#22c55e" : level <= 1 ? "#ef4444" : "#C4704B";
                        return <Cell key={entry.consensus} fill={color} fillOpacity={0.8} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: "center", color: "#A89B8C", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12, fontSize: 13 }}>
          Charts appear here once you have training data. Use the Sandbox to generate your first entries.
        </div>
      )}

      {/* Alert + quick links */}
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
          { href: "/internal/dataset", title: "Dataset", desc: "Browse and export all labeled training entries" },
        ].map(({ href, title, desc }) => (
          <a key={href} href={href} style={{ textDecoration: "none" }}>
            <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12, cursor: "pointer" }}
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
