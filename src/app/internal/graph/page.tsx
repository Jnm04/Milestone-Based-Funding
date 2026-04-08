"use client";

import { useEffect, useRef, useState, useCallback, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";

// Three.js / R3F — browser-only, must be dynamically imported
const BrainGraph3D = dynamic(() => import("./BrainGraph3D"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "2px solid rgba(196,112,75,0.2)", borderTopColor: "#C4704B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <p style={{ color: "#A89B8C", fontSize: 13, margin: 0 }}>Initialising 3D engine…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  consensusLevel: number;
  milestoneText: string;
  labelSource: string;
  fraudType: string | null;
  createdAt: string;
  hasEmbedding: boolean;
  // injected by d3-force-3d
  x?: number; y?: number; z?: number;
  vx?: number; vy?: number; vz?: number;
  fx?: number; fy?: number; fz?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  similarity: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: {
    totalNodes: number;
    totalLinks: number;
    nodesWithEmbedding: number;
    trainingCount: number;
    pendingCount: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const LABEL_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED:    "#f97316",
  PENDING:  "#eab308",
};

const LABEL_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  FAKED:    "Faked / Fraud",
  PENDING:  "Pending Review",
};

const SOURCE_LABELS: Record<string, string> = {
  AUTO_5_0:   "Auto 5-0",
  AUTO_4_1:   "Auto 4-1",
  HUMAN:      "Human review",
  HUMAN_QUEUE:"Awaiting review",
  GRANT_GIVER:"Grant giver",
};

function hexToRgb(hex: string) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}80` }} />
      <span style={{ fontSize: 11, color: "#A89B8C" }}>{label}</span>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const { r, g, b } = hexToRgb(color);
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:20, background:`rgba(${r},${g},${b},0.15)`, border:`1px solid rgba(${r},${g},${b},0.4)`, color, fontSize:11, fontWeight:600 }}>
      {children}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BrainMapPage() {
  const [data, setData]           = useState<GraphData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<GraphNode | null>(null);

  const resetRef = useRef<() => void>(() => {});

  const key = () =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem("cascrow_internal_key") ?? "" : "";

  useEffect(() => {
    fetch("/api/internal/graph", { headers: { "x-internal-key": key() } })
      .then(r => r.ok ? r.json() : null)
      .then((d: GraphData | null) => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const labelCounts = useMemo(() =>
    data?.nodes.reduce<Record<string,number>>((acc, n) => { acc[n.label] = (acc[n.label] ?? 0) + 1; return acc; }, {}) ?? {}
  , [data]);

  // ── Render: loading ──
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:400, flexDirection:"column", gap:12 }}>
      <div style={{ width:32, height:32, border:"2px solid rgba(196,112,75,0.2)", borderTopColor:"#C4704B", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <p style={{ color:"#A89B8C", fontSize:13 }}>Fetching brain data…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── Render: empty state ──
  if (!data || data.nodes.length === 0) return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:300, marginBottom:4 }}>Brain Map</h1>
        <p style={{ color:"#A89B8C", fontSize:13 }}>3D similarity graph of all labeled training entries.</p>
      </div>
      <div style={{ padding:48, textAlign:"center", border:"1px dashed rgba(196,112,75,0.2)", borderRadius:16, color:"#A89B8C", fontSize:13, lineHeight:1.8 }}>
        <div style={{ fontSize:32, marginBottom:12, opacity:0.4 }}>◎</div>
        <strong style={{ color:"#EDE6DD" }}>No data yet</strong><br />
        The graph appears once you have training entries with embeddings.<br />
        Use the <a href="/internal/sandbox" style={{ color:"#C4704B" }}>Sandbox</a> to run your first verifications.
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:300, marginBottom:4 }}>Brain Map</h1>
          <p style={{ color:"#A89B8C", fontSize:13 }}>
            {data.meta.totalNodes} nodes · {data.meta.totalLinks} similarity edges
            {data.meta.nodesWithEmbedding < data.meta.totalNodes && (
              <span style={{ color:"#f97316" }}> · {data.meta.totalNodes - data.meta.nodesWithEmbedding} without embeddings</span>
            )}
          </p>
        </div>
        <button
          onClick={() => resetRef.current?.()}
          style={{ padding:"7px 14px", borderRadius:8, background:"rgba(196,112,75,0.08)", border:"1px solid rgba(196,112,75,0.25)", color:"#C4704B", fontSize:12, cursor:"pointer" }}
        >
          Reset camera
        </button>
      </div>

      {/* 3D canvas + sidebar */}
      <div style={{ display:"grid", gridTemplateColumns: selected ? "1fr 300px" : "1fr", gap:16, alignItems:"start" }}>

        {/* Canvas */}
        <div style={{ position:"relative", height:"calc(100vh - 210px)", minHeight:480, borderRadius:16, border:"1px solid rgba(196,112,75,0.12)", overflow:"hidden", background:"#060504" }}>
          <BrainGraph3D
            data={data}
            onNodeSelect={setSelected}
            selectedId={selected?.id ?? null}
            onResetRef={resetRef}
          />

          {/* Legend */}
          <div style={{ position:"absolute", bottom:20, left:20, padding:"12px 16px", background:"rgba(6,5,4,0.85)", border:"1px solid rgba(196,112,75,0.12)", borderRadius:10, backdropFilter:"blur(8px)", pointerEvents:"none" }}>
            <div style={{ fontSize:10, color:"#C4704B", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Labels</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {Object.entries(LABEL_COLORS).map(([lbl, col]) => (
                <LegendDot key={lbl} color={col} label={`${LABEL_LABELS[lbl]} (${labelCounts[lbl] ?? 0})`} />
              ))}
            </div>
            <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid rgba(196,112,75,0.1)" }}>
              <div style={{ fontSize:10, color:"#A89B8C" }}>Drag to rotate · Scroll to zoom</div>
              <div style={{ fontSize:10, color:"#A89B8C", marginTop:2 }}>Node size = consensus level</div>
            </div>
          </div>

          {/* No-edges notice */}
          {data.links.length === 0 && (
            <div style={{ position:"absolute", top:16, right:16, padding:"7px 14px", background:"rgba(234,179,8,0.08)", border:"1px solid rgba(234,179,8,0.2)", borderRadius:8, fontSize:11, color:"#eab308", pointerEvents:"none" }}>
              No similarity edges yet — add more entries
            </div>
          )}
        </div>

        {/* Sidebar */}
        {selected && (
          <div style={{ padding:20, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(196,112,75,0.15)", borderRadius:16, display:"flex", flexDirection:"column", gap:16, height:"calc(100vh - 210px)", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <Badge color={LABEL_COLORS[selected.label] ?? "#A89B8C"}>{LABEL_LABELS[selected.label] ?? selected.label}</Badge>
              <button onClick={() => setSelected(null)} style={{ background:"none", border:"none", color:"#A89B8C", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
            </div>

            <div>
              <div style={{ fontSize:10, color:"#C4704B", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Milestone</div>
              <p style={{ fontSize:13, color:"#EDE6DD", lineHeight:1.65, margin:0 }}>{selected.milestoneText}</p>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { label:"Consensus", value:`${selected.consensusLevel}/5` },
                { label:"Source", value: SOURCE_LABELS[selected.labelSource] ?? selected.labelSource },
                { label:"Date", value: new Date(selected.createdAt).toLocaleDateString("de-DE") },
                { label:"Embedding", value: selected.hasEmbedding ? "✓ Indexed" : "— Missing" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding:"10px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
                  <div style={{ fontSize:10, color:"#A89B8C", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:13, color:"#EDE6DD" }}>{value}</div>
                </div>
              ))}
            </div>

            {selected.fraudType && (
              <div style={{ padding:"10px 14px", background:"rgba(249,115,22,0.07)", border:"1px solid rgba(249,115,22,0.2)", borderRadius:8 }}>
                <div style={{ fontSize:10, color:"#f97316", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Fraud type</div>
                <div style={{ fontSize:13, color:"#EDE6DD" }}>{selected.fraudType}</div>
              </div>
            )}

            <div style={{ marginTop:"auto", paddingTop:12, borderTop:"1px solid rgba(196,112,75,0.08)" }}>
              <div style={{ fontSize:10, color:"rgba(168,155,140,0.35)", fontFamily:"monospace", wordBreak:"break-all" }}>{selected.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
