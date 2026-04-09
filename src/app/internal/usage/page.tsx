"use client";

import { useEffect, useState } from "react";

interface ModelStat {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

interface DayPoint {
  date: string;
  cost: number;
  tokens: number;
}

interface UsageData {
  totalCostUsd: number;
  totalTokens: number;
  totalCalls: number;
  byModel: ModelStat[];
  dailySeries: DayPoint[];
}

const MODEL_COLOR: Record<string, string> = {
  "Claude Haiku":    "#C4704B",
  "GPT-4o-mini":    "#22c55e",
  "Gemini Flash":   "#3b82f6",
  "Mistral Small":  "#a855f7",
  "Cerebras/Qwen3": "#eab308",
  "Embedding":      "#6b7280",
};

const PROVIDER_LINKS = [
  {
    name: "Anthropic Console",
    desc: "Claude Haiku balance & usage",
    color: "#C4704B",
    url: "https://console.anthropic.com/settings/billing",
  },
  {
    name: "OpenAI Platform",
    desc: "GPT-4o-mini credits & usage",
    color: "#22c55e",
    url: "https://platform.openai.com/account/billing",
  },
  {
    name: "Google AI Studio",
    desc: "Gemini Flash quota & billing",
    color: "#3b82f6",
    url: "https://aistudio.google.com/",
  },
  {
    name: "Mistral Console",
    desc: "Mistral Small billing",
    color: "#a855f7",
    url: "https://console.mistral.ai/billing",
  },
  {
    name: "Cerebras Cloud",
    desc: "Cerebras/Qwen3 usage",
    color: "#eab308",
    url: "https://cloud.cerebras.ai/",
  },
];

function fmt(n: number, decimals = 4) {
  return n.toFixed(decimals);
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const key = () => sessionStorage.getItem("cascrow_internal_key") ?? "";

  function load() {
    setLoading(true);
    fetch("/api/internal/usage", { headers: { "x-internal-key": key() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }

  useEffect(() => { load(); }, []);

  if (loading) return <p style={{ color: "#A89B8C" }}>Loading usage data…</p>;

  const hasData = data && data.totalCalls > 0;
  const maxCost = data ? Math.max(...data.byModel.map((m) => m.estimatedCostUsd), 0.000001) : 1;

  // Daily chart
  const maxDayCost = data ? Math.max(...data.dailySeries.map((d) => d.cost), 0.000001) : 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>API Usage & Costs</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>
            Estimated costs from token usage. Actual balance must be checked on provider dashboards.{" "}
            <button onClick={load} style={{ background: "none", border: "none", color: "#C4704B", cursor: "pointer", fontSize: 13, padding: 0 }}>
              ↻ Refresh
            </button>
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "Estimated Total Cost", value: `$${fmt(data?.totalCostUsd ?? 0)}`, sub: "all time" },
          { label: "Total Tokens Used", value: fmtTokens(data?.totalTokens ?? 0), sub: "input + output" },
          { label: "Total API Calls", value: String(data?.totalCalls ?? 0), sub: "across all models" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ padding: "18px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 300, color: "#EDE6DD", letterSpacing: "-0.02em" }}>{value}</div>
            <div style={{ fontSize: 11, color: "rgba(168,155,140,0.5)", marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {!hasData && (
        <div style={{ padding: 32, textAlign: "center", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12, color: "#A89B8C", fontSize: 13 }}>
          No usage logged yet. Run a verification in Sandbox or Generate to start tracking.
        </div>
      )}

      {hasData && (
        <>
          {/* Per-model breakdown */}
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(196,112,75,0.1)" }}>
              <span style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.1em" }}>By Model (all time)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {data.byModel.map((m) => {
                const color = MODEL_COLOR[m.model] ?? "#A89B8C";
                const barPct = (m.estimatedCostUsd / maxCost) * 100;
                return (
                  <div key={m.model} style={{ padding: "14px 20px", borderBottom: "1px solid rgba(196,112,75,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}60` }} />
                        <span style={{ fontSize: 14, color: "#EDE6DD", fontWeight: 500 }}>{m.model}</span>
                        <span style={{ fontSize: 11, color: "#A89B8C" }}>{m.calls} calls</span>
                      </div>
                      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#A89B8C" }}>{fmtTokens(m.inputTokens + m.outputTokens)} tokens</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
                          ${fmt(m.estimatedCostUsd)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: color, borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ display: "flex", gap: 20 }}>
                      <span style={{ fontSize: 11, color: "rgba(168,155,140,0.5)" }}>in: {fmtTokens(m.inputTokens)}</span>
                      <span style={{ fontSize: 11, color: "rgba(168,155,140,0.5)" }}>out: {fmtTokens(m.outputTokens)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily cost chart (last 30 days) */}
          {data.dailySeries.length > 0 && (
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
                Daily Cost — Last 30 Days
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                {data.dailySeries.map((d) => {
                  const h = Math.max(2, (d.cost / maxDayCost) * 72);
                  return (
                    <div key={d.date} title={`${d.date}: $${fmt(d.cost)} · ${fmtTokens(d.tokens)} tokens`}
                      style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "default" }}>
                      <div style={{ width: "100%", height: h, background: "#C4704B", borderRadius: "2px 2px 0 0", opacity: 0.75, transition: "opacity 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "rgba(168,155,140,0.4)" }}>{data.dailySeries[0]?.date}</span>
                <span style={{ fontSize: 10, color: "rgba(168,155,140,0.4)" }}>{data.dailySeries[data.dailySeries.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Provider balance links */}
      <div>
        <div style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          Check actual balance on provider dashboards
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PROVIDER_LINKS.map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
              style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: `1px solid rgba(${hexToRgbStr(p.color)},0.15)`, borderRadius: 10, textDecoration: "none", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = `rgba(${hexToRgbStr(p.color)},0.4)`)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = `rgba(${hexToRgbStr(p.color)},0.15)`)}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: p.color }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#A89B8C", marginTop: 2 }}>{p.desc}</div>
              </div>
              <span style={{ fontSize: 16, color: "#A89B8C", opacity: 0.5 }}>↗</span>
            </a>
          ))}
        </div>
      </div>

      {/* Pricing note */}
      <p style={{ fontSize: 11, color: "rgba(168,155,140,0.4)", lineHeight: 1.6, margin: 0 }}>
        Pricing used: Claude Haiku $0.80/$4.00 · GPT-4o-mini $0.15/$0.60 · Gemini Flash $0.15/$0.60 · Mistral Small $0.10/$0.30 · Cerebras/Qwen3 $0.77/$0.77 (per 1M tokens, input/output).
        These are estimates — check provider dashboards for exact billing.
      </p>
    </div>
  );
}

function hexToRgbStr(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
