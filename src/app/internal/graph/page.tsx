"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useCallback, Component, ErrorInfo, ReactNode } from "react";

// ─── Error boundary ───────────────────────────────────────────────────────────
class GraphErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: error.message ?? "Unknown error" };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BrainMap] Graph render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, textAlign: "center", color: "#A89B8C", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⚠</div>
          <strong style={{ color: "#EDE6DD" }}>Graph failed to render</strong>
          <p style={{ fontSize: 12, marginTop: 6 }}>{this.state.error}</p>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, padding: "6px 16px", borderRadius: 8, background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.3)", color: "#C4704B", cursor: "pointer", fontSize: 13 }}>
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ForceGraph2D uses browser APIs — must be loaded client-side only
const ForceGraph2D = dynamic(
  () => import("react-force-graph").then((m) => m.ForceGraph2D),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  consensusLevel: number;
  milestoneText: string;
  labelSource: string;
  fraudType: string | null;
  createdAt: string;
  hasEmbedding: boolean;
  // Injected by force-graph at runtime
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  similarity: number;
}

interface GraphData {
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

const LABEL_COLORS: Record<string, string> = {
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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: color,
        boxShadow: `0 0 6px ${color}80`,
      }} />
      <span style={{ fontSize: 11, color: "#A89B8C" }}>{label}</span>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const { r, g, b } = hexToRgb(color);
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      background: `rgba(${r},${g},${b},0.15)`,
      border: `1px solid rgba(${r},${g},${b},0.4)`,
      color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.05em",
    }}>
      {children}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrainMapPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodeIds, setHighlightNodeIds] = useState<Set<string>>(new Set());
  const [highlightLinkKeys, setHighlightLinkKeys] = useState<Set<string>>(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 900, height: 650 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const key = () =>
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("cascrow_internal_key") ?? ""
      : "";

  // Fetch graph data
  useEffect(() => {
    fetch("/api/internal/graph", { headers: { "x-internal-key": key() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphData | null) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Track container size
  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(600, 60);
  }, []);

  // ── Node interactions ──

  const handleNodeClick = useCallback(
    (node: object) => {
      const n = node as GraphNode;
      if (selectedNode?.id === n.id) {
        setSelectedNode(null);
        setHighlightNodeIds(new Set());
        setHighlightLinkKeys(new Set());
        return;
      }
      setSelectedNode(n);

      const neighborIds = new Set<string>([n.id]);
      const linkKeys = new Set<string>();

      if (data) {
        for (const link of data.links) {
          const srcId =
            typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
          const tgtId =
            typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
          if (srcId === n.id || tgtId === n.id) {
            neighborIds.add(srcId);
            neighborIds.add(tgtId);
            linkKeys.add(`${srcId}||${tgtId}`);
          }
        }
      }
      setHighlightNodeIds(neighborIds);
      setHighlightLinkKeys(linkKeys);
    },
    [data, selectedNode]
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodeIds(new Set());
    setHighlightLinkKeys(new Set());
  }, []);

  // ── Canvas rendering ──

  const nodeCanvasObject = useCallback(
    (nodeObj: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = nodeObj as GraphNode;
      const { x = 0, y = 0, id, label, consensusLevel } = node;

      const color = LABEL_COLORS[label] ?? "#A89B8C";
      const { r, g, b } = hexToRgb(color);

      const isSelected = selectedNode?.id === id;
      const isHighlighted =
        highlightNodeIds.size === 0 || highlightNodeIds.has(id);
      const isHovered = hoverNode?.id === id;

      const baseRadius = 3.5 + consensusLevel * 1.4; // 3.5–10.5 range
      const radius = isSelected ? baseRadius * 1.35 : baseRadius;

      // Dim unrelated nodes when something is selected/highlighted
      const alpha = highlightNodeIds.size > 0 && !isHighlighted ? 0.12 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outer glow
      if (isHighlighted || highlightNodeIds.size === 0) {
        const glowRadius = radius * (isSelected ? 4.5 : isHovered ? 3.8 : 3);
        const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, glowRadius);
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner highlight (top-left shimmer)
      const shimmer = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, 0,
        x, y, radius
      );
      shimmer.addColorStop(0, "rgba(255,255,255,0.28)");
      shimmer.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = shimmer;
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();

        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.4)`;
        ctx.lineWidth = 0.8 / globalScale;
        ctx.stroke();
      }

      // Label text — only when zoomed in enough
      if (globalScale > 2.2 && isHighlighted) {
        const label16 = node.milestoneText.slice(0, 22);
        ctx.font = `${11 / globalScale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(237,230,221,${Math.min(1, (globalScale - 2.2) * 0.7)})`;
        ctx.fillText(label16, x, y + radius + 9 / globalScale);
      }

      ctx.restore();
    },
    [selectedNode, highlightNodeIds, hoverNode]
  );

  const nodePointerAreaPaint = useCallback(
    (nodeObj: object, color: string, ctx: CanvasRenderingContext2D) => {
      const node = nodeObj as GraphNode;
      const { x = 0, y = 0, consensusLevel } = node;
      const radius = 5 + consensusLevel * 1.4;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    },
    []
  );

  const getLinkColor = useCallback(
    (linkObj: object) => {
      const link = linkObj as GraphLink;
      const srcId =
        typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const tgtId =
        typeof link.target === "object" ? (link.target as GraphNode).id : link.target;

      const key = `${srcId}||${tgtId}`;
      const revKey = `${tgtId}||${srcId}`;
      const isActive =
        highlightLinkKeys.size === 0 ||
        highlightLinkKeys.has(key) ||
        highlightLinkKeys.has(revKey);

      const srcNode = data?.nodes.find((n) => n.id === srcId);
      const tgtNode = data?.nodes.find((n) => n.id === tgtId);

      const alpha = isActive ? (highlightLinkKeys.size === 0 ? 0.18 : 0.55) : 0.04;

      if (srcNode && tgtNode && srcNode.label === tgtNode.label) {
        const col = LABEL_COLORS[srcNode.label] ?? "#C4704B";
        const { r, g, b } = hexToRgb(col);
        return `rgba(${r},${g},${b},${alpha})`;
      }
      return `rgba(196,112,75,${alpha})`;
    },
    [highlightLinkKeys, data]
  );

  const getLinkWidth = useCallback(
    (linkObj: object) => {
      const link = linkObj as GraphLink;
      const sim = link.similarity ?? 0.7;
      const srcId =
        typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const tgtId =
        typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
      const key = `${srcId}||${tgtId}`;
      const revKey = `${tgtId}||${srcId}`;
      const isActive =
        highlightLinkKeys.size === 0 ||
        highlightLinkKeys.has(key) ||
        highlightLinkKeys.has(revKey);
      return isActive ? 0.5 + sim * 1.5 : 0.3;
    },
    [highlightLinkKeys]
  );

  // ── Label breakdown for stats ──
  const labelCounts =
    data?.nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.label] = (acc[n.label] ?? 0) + 1;
      return acc;
    }, {}) ?? {};

  // ── Render ──

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12 }}>
        <div style={{ width: 36, height: 36, border: "2px solid rgba(196,112,75,0.2)", borderTopColor: "#C4704B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Building brain map…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Brain Map</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>Interactive similarity graph of all labeled training entries.</p>
        </div>
        <div style={{
          padding: 48, textAlign: "center", border: "1px dashed rgba(196,112,75,0.2)",
          borderRadius: 16, color: "#A89B8C", fontSize: 13, lineHeight: 1.8,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◎</div>
          <strong style={{ color: "#EDE6DD" }}>No data yet</strong><br />
          The graph appears once you have training entries with embeddings.<br />
          Use the <a href="/internal/sandbox" style={{ color: "#C4704B" }}>Sandbox</a> to run your first verifications.
          {!data?.meta?.nodesWithEmbedding && data && data.nodes.length > 0 && (
            <><br /><br /><span style={{ color: "#f97316" }}>Entries found but no embeddings — make sure OPENAI_API_KEY is set.</span></>
          )}
        </div>
      </div>
    );
  }

  const hasNoEdges = data.links.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Brain Map</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>
            {data.meta.totalNodes} nodes · {data.meta.totalLinks} similarity edges
            {data.meta.nodesWithEmbedding < data.meta.totalNodes && (
              <span style={{ color: "#f97316" }}>
                {" "}· {data.meta.totalNodes - data.meta.nodesWithEmbedding} without embeddings
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fgRef.current?.zoomToFit(400, 60)}
          style={{
            padding: "7px 14px", borderRadius: 8, background: "rgba(196,112,75,0.08)",
            border: "1px solid rgba(196,112,75,0.25)", color: "#C4704B",
            fontSize: 12, cursor: "pointer",
          }}
        >
          Zoom to fit
        </button>
      </div>

      {/* Main canvas + detail panel */}
      <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 300px" : "1fr", gap: 16, alignItems: "start" }}>

        {/* Graph canvas */}
        <div
          ref={containerRef}
          style={{
            position: "relative",
            height: "calc(100vh - 210px)",
            minHeight: 500,
            background: "#0d0b09",
            borderRadius: 16,
            border: "1px solid rgba(196,112,75,0.12)",
            overflow: "hidden",
          }}
        >
          <GraphErrorBoundary>
            <ForceGraph2D
              ref={fgRef}
              graphData={data}
              width={dims.width}
              height={dims.height}
              backgroundColor="#0d0b09"
              nodeCanvasObject={nodeCanvasObject}
              nodeCanvasObjectMode={() => "replace"}
              nodePointerAreaPaint={nodePointerAreaPaint}
              linkColor={getLinkColor}
              linkWidth={getLinkWidth}
              linkCurvature={0.08}
              onNodeClick={handleNodeClick}
              onBackgroundClick={handleBackgroundClick}
              onNodeHover={(node) => setHoverNode(node as GraphNode | null)}
              onEngineStop={handleEngineStop}
              cooldownTicks={120}
              d3AlphaDecay={0.025}
              d3VelocityDecay={0.35}
              enableNodeDrag
              enableZoomInteraction
              enablePanInteraction
            />
          </GraphErrorBoundary>

          {/* Legend — bottom-left overlay */}
          <div style={{
            position: "absolute", bottom: 20, left: 20,
            display: "flex", flexDirection: "column", gap: 6,
            padding: "12px 16px",
            background: "rgba(13,11,9,0.82)",
            border: "1px solid rgba(196,112,75,0.12)",
            borderRadius: 10,
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>Labels</div>
            {Object.entries(LABEL_COLORS).map(([lbl, col]) => (
              <LegendDot key={lbl} color={col} label={`${LABEL_LABELS[lbl]} (${labelCounts[lbl] ?? 0})`} />
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(196,112,75,0.1)" }}>
              <div style={{ fontSize: 10, color: "#A89B8C" }}>Node size = consensus level</div>
              <div style={{ fontSize: 10, color: "#A89B8C", marginTop: 2 }}>Lines = semantic similarity</div>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoverNode && !selectedNode && (
            <div style={{
              position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
              background: "rgba(13,11,9,0.9)",
              border: "1px solid rgba(196,112,75,0.2)",
              borderRadius: 8, padding: "8px 14px",
              maxWidth: 380, pointerEvents: "none",
              backdropFilter: "blur(8px)",
            }}>
              <div style={{ fontSize: 11, color: LABEL_COLORS[hoverNode.label] ?? "#A89B8C", marginBottom: 3, fontWeight: 600 }}>
                {LABEL_LABELS[hoverNode.label] ?? hoverNode.label} · {hoverNode.consensusLevel}/5
              </div>
              <div style={{ fontSize: 12, color: "#C8BEB4", lineHeight: 1.5 }}>
                {hoverNode.milestoneText.slice(0, 100)}{hoverNode.milestoneText.length > 100 ? "…" : ""}
              </div>
            </div>
          )}

          {/* No edges notice */}
          {hasNoEdges && (
            <div style={{
              position: "absolute", top: 16, right: 16,
              padding: "8px 14px", background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8,
              fontSize: 11, color: "#eab308",
            }}>
              No similarity edges yet — more entries needed
            </div>
          )}
        </div>

        {/* Detail panel — slides in on node select */}
        {selectedNode && (
          <div style={{
            padding: 20,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            height: "calc(100vh - 210px)",
            overflowY: "auto",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Badge color={LABEL_COLORS[selectedNode.label] ?? "#A89B8C"}>
                {LABEL_LABELS[selectedNode.label] ?? selectedNode.label}
              </Badge>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setHighlightNodeIds(new Set());
                  setHighlightLinkKeys(new Set());
                }}
                style={{ background: "none", border: "none", color: "#A89B8C", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Milestone text */}
            <div>
              <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Milestone</div>
              <p style={{ fontSize: 13, color: "#EDE6DD", lineHeight: 1.65, margin: 0 }}>{selectedNode.milestoneText}</p>
            </div>

            {/* Meta grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Consensus", value: `${selectedNode.consensusLevel}/5` },
                { label: "Source", value: SOURCE_LABELS[selectedNode.labelSource] ?? selectedNode.labelSource },
                { label: "Date", value: new Date(selectedNode.createdAt).toLocaleDateString("de-DE") },
                { label: "Embedding", value: selectedNode.hasEmbedding ? "✓ Indexed" : "— Missing" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#A89B8C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#EDE6DD" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Fraud type if present */}
            {selectedNode.fraudType && (
              <div style={{ padding: "10px 14px", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "#f97316", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Fraud type</div>
                <div style={{ fontSize: 13, color: "#EDE6DD" }}>{selectedNode.fraudType}</div>
              </div>
            )}

            {/* Neighbors */}
            {highlightNodeIds.size > 1 && (
              <div>
                <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Similar nodes ({highlightNodeIds.size - 1})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.links
                    .filter((link) => {
                      const srcId = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
                      const tgtId = typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
                      return srcId === selectedNode.id || tgtId === selectedNode.id;
                    })
                    .sort((a, b) => b.similarity - a.similarity)
                    .map((link) => {
                      const srcId = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
                      const tgtId = typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
                      const neighborId = srcId === selectedNode.id ? tgtId : srcId;
                      const neighbor = data.nodes.find((n) => n.id === neighborId);
                      if (!neighbor) return null;
                      return (
                        <div
                          key={neighborId}
                          onClick={() => handleNodeClick(neighbor)}
                          style={{
                            padding: "8px 10px",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(196,112,75,0.1)",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.3)")}
                          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.1)")}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: LABEL_COLORS[neighbor.label] ?? "#A89B8C" }}>
                              {neighbor.label}
                            </span>
                            <span style={{ fontSize: 10, color: "#A89B8C" }}>
                              {(link.similarity * 100).toFixed(0)}% similar
                            </span>
                          </div>
                          <p style={{ fontSize: 11, color: "#C8BEB4", margin: 0, lineHeight: 1.4 }}>
                            {neighbor.milestoneText.slice(0, 70)}{neighbor.milestoneText.length > 70 ? "…" : ""}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Proof ID (dev reference) */}
            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(196,112,75,0.08)" }}>
              <div style={{ fontSize: 10, color: "rgba(168,155,140,0.4)", fontFamily: "monospace", wordBreak: "break-all" }}>
                {selectedNode.id}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
