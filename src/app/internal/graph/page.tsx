"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3Force from "d3-force";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends d3Force.SimulationNodeDatum {
  id: string;
  label: string;
  consensusLevel: number;
  milestoneText: string;
  labelSource: string;
  fraudType: string | null;
  createdAt: string;
  hasEmbedding: boolean;
}

interface GraphLink extends d3Force.SimulationLinkDatum<GraphNode> {
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function nodeRadius(n: GraphNode) {
  return 4 + n.consensusLevel * 1.4;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, background: `rgba(${r},${g},${b},0.15)`, border: `1px solid rgba(${r},${g},${b},0.4)`, color, fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrainMapPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [neighborIds, setNeighborIds] = useState<Set<string>>(new Set());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3Force.Simulation<GraphNode, GraphLink> | null>(null);
  const simNodesRef = useRef<GraphNode[]>([]);
  const simLinksRef = useRef<GraphLink[]>([]);
  const animRef = useRef<number>(0);

  // Transform: pan + zoom
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  // Drag state
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number; dragging: boolean }>({
    node: null, offsetX: 0, offsetY: 0, dragging: false,
  });
  // Pan state
  const panRef = useRef<{ active: boolean; startX: number; startY: number; tx: number; ty: number }>({
    active: false, startX: 0, startY: 0, tx: 0, ty: 0,
  });

  const selectedRef = useRef<GraphNode | null>(null);
  const hoverRef = useRef<GraphNode | null>(null);
  const neighborRef = useRef<Set<string>>(new Set());

  // Keep refs in sync with state (canvas draw loop reads refs, not state)
  useEffect(() => { selectedRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { hoverRef.current = hoverNode; }, [hoverNode]);
  useEffect(() => { neighborRef.current = neighborIds; }, [neighborIds]);

  const key = () =>
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem("cascrow_internal_key") ?? "" : "";

  // Fetch graph data
  useEffect(() => {
    fetch("/api/internal/graph", { headers: { "x-internal-key": key() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GraphData | null) => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Canvas draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x: tx, y: ty, k } = transformRef.current;
    const nodes = simNodesRef.current;
    const links = simLinksRef.current;
    const sel = selectedRef.current;
    const hov = hoverRef.current;
    const neighbors = neighborRef.current;
    const hasSelection = neighbors.size > 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(k, k);

    // ── Links ──
    for (const link of links) {
      const src = link.source as GraphNode;
      const tgt = link.target as GraphNode;
      if (src.x == null || tgt.x == null) continue;

      const isActive = !hasSelection ||
        (neighbors.has(src.id) && neighbors.has(tgt.id));

      const srcColor = LABEL_COLORS[src.label] ?? "#C4704B";
      const tgtColor = LABEL_COLORS[tgt.label] ?? "#C4704B";
      const sameLabel = src.label === tgt.label;
      const baseAlpha = isActive ? (hasSelection ? 0.6 : 0.18) : 0.03;

      if (sameLabel && isActive) {
        const { r, g, b } = hexToRgb(srcColor);
        ctx.strokeStyle = `rgba(${r},${g},${b},${baseAlpha})`;
      } else {
        ctx.strokeStyle = `rgba(196,112,75,${baseAlpha})`;
      }
      ctx.lineWidth = isActive ? (0.5 + link.similarity * 1.2) / k : 0.4 / k;

      // Slight curve
      const midX = (src.x! + tgt.x!) / 2 + (tgt.y! - src.y!) * 0.06;
      const midY = (src.y! + tgt.y!) / 2 - (tgt.x! - src.x!) * 0.06;
      ctx.beginPath();
      ctx.moveTo(src.x!, src.y!);
      ctx.quadraticCurveTo(midX, midY, tgt.x!, tgt.y!);
      ctx.stroke();
    }

    // ── Nodes ──
    for (const node of nodes) {
      if (node.x == null) continue;
      const { x, y } = node;
      const color = LABEL_COLORS[node.label] ?? "#A89B8C";
      const { r, g, b } = hexToRgb(color);
      const radius = nodeRadius(node);

      const isSelected = sel?.id === node.id;
      const isHovered = hov?.id === node.id;
      const isActive = !hasSelection || neighbors.has(node.id);
      const alpha = isActive ? 1 : 0.1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Outer glow
      const glowR = radius * (isSelected ? 5 : isHovered ? 4 : 3.2);
      const grd = ctx.createRadialGradient(x, y, radius * 0.2, x, y, glowR);
      grd.addColorStop(0, `rgba(${r},${g},${b},${isSelected ? 0.5 : 0.3})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Inner shimmer
      const shim = ctx.createRadialGradient(x - radius * 0.32, y - radius * 0.32, 0, x, y, radius);
      shim.addColorStop(0, "rgba(255,255,255,0.28)");
      shim.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = shim;
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2.5 / k, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / k;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, radius + 5.5 / k, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
        ctx.lineWidth = 0.8 / k;
        ctx.stroke();
      }

      // Node label at high zoom
      if (k > 2.4 && isActive) {
        const txt = node.milestoneText.slice(0, 20);
        ctx.font = `${10 / k}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(237,230,221,${Math.min(1, (k - 2.4) * 0.8)})`;
        ctx.fillText(txt, x, y + radius + 10 / k);
      }

      ctx.restore();
    }

    ctx.restore();
    animRef.current = requestAnimationFrame(draw);
  }, []);

  // Build simulation when data arrives
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const w = canvas.width;
    const h = canvas.height;

    // Deep clone so d3 can mutate freely
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const links: GraphLink[] = data.links.map((l) => ({ ...l, source: l.source as string, target: l.target as string }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;

    if (simRef.current) simRef.current.stop();
    cancelAnimationFrame(animRef.current);

    const sim = d3Force.forceSimulation<GraphNode>(nodes)
      .force("link", d3Force.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(70)
        .strength(0.5))
      .force("charge", d3Force.forceManyBody<GraphNode>().strength(-180))
      .force("center", d3Force.forceCenter(w / 2, h / 2))
      .force("collision", d3Force.forceCollide<GraphNode>((d) => nodeRadius(d) + 4))
      .alphaDecay(0.025)
      .velocityDecay(0.35);

    simRef.current = sim;

    // Start draw loop
    animRef.current = requestAnimationFrame(draw);

    // Zoom to fit when simulation settles
    sim.on("end", () => {
      if (nodes.length === 0) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const n of nodes) {
        if (n.x == null) continue;
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x);
        minY = Math.min(minY, n.y!);
        maxY = Math.max(maxY, n.y!);
      }
      const pad = 60;
      const scaleX = (w - pad * 2) / (maxX - minX || 1);
      const scaleY = (h - pad * 2) / (maxY - minY || 1);
      const k = Math.min(scaleX, scaleY, 2.5);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      transformRef.current = { x: w / 2 - cx * k, y: h / 2 - cy * k, k };
    });

    return () => {
      sim.stop();
      cancelAnimationFrame(animRef.current);
    };
  }, [data, draw]);

  // Resize canvas to container
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = el.offsetWidth;
      canvas.height = el.offsetHeight;
    });
    canvas.width = el.offsetWidth;
    canvas.height = el.offsetHeight;
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Helpers ──

  function getNodeAt(cx: number, cy: number): GraphNode | null {
    const { x: tx, y: ty, k } = transformRef.current;
    const wx = (cx - tx) / k;
    const wy = (cy - ty) / k;
    for (const node of [...simNodesRef.current].reverse()) {
      if (node.x == null) continue;
      const r = nodeRadius(node) + 4;
      if ((wx - node.x) ** 2 + (wy - node.y!) ** 2 <= r * r) return node;
    }
    return null;
  }

  function selectNode(node: GraphNode | null) {
    setSelectedNode(node);
    selectedRef.current = node;
    if (!node) {
      setNeighborIds(new Set());
      neighborRef.current = new Set();
      return;
    }
    const ids = new Set<string>([node.id]);
    for (const link of simLinksRef.current) {
      const srcId = (link.source as GraphNode).id ?? link.source;
      const tgtId = (link.target as GraphNode).id ?? link.target;
      if (srcId === node.id) ids.add(tgtId as string);
      if (tgtId === node.id) ids.add(srcId as string);
    }
    setNeighborIds(ids);
    neighborRef.current = ids;
  }

  // ── Mouse / touch events ──

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = getNodeAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    if (node) {
      dragRef.current = { node, offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY, dragging: false };
      node.fx = node.x;
      node.fy = node.y;
    } else {
      panRef.current = { active: true, startX: e.nativeEvent.offsetX, startY: e.nativeEvent.offsetY, tx: transformRef.current.x, ty: transformRef.current.y };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x: ox, y: oy } = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };

    // Drag node
    const drag = dragRef.current;
    if (drag.node) {
      drag.dragging = true;
      const { k, x: tx, y: ty } = transformRef.current;
      drag.node.fx = (ox - tx) / k;
      drag.node.fy = (oy - ty) / k;
      simRef.current?.alphaTarget(0.15).restart();
      return;
    }

    // Pan canvas
    const pan = panRef.current;
    if (pan.active) {
      transformRef.current.x = pan.tx + (ox - pan.startX);
      transformRef.current.y = pan.ty + (oy - pan.startY);
      return;
    }

    // Hover detection
    const node = getNodeAt(ox, oy);
    if (node?.id !== hoverRef.current?.id) {
      setHoverNode(node);
      hoverRef.current = node;
      (e.currentTarget as HTMLCanvasElement).style.cursor = node ? "pointer" : "grab";
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag.node) {
      if (!drag.dragging) {
        // Click — select node
        const nodeInSim = simNodesRef.current.find((n) => n.id === drag.node!.id) ?? null;
        if (nodeInSim?.id === selectedRef.current?.id) {
          selectNode(null);
        } else {
          selectNode(nodeInSim);
        }
      }
      // Release drag
      drag.node.fx = undefined;
      drag.node.fy = undefined;
      simRef.current?.alphaTarget(0);
      dragRef.current = { node: null, offsetX: 0, offsetY: 0, dragging: false };
    } else {
      panRef.current.active = false;
      // Click on background → deselect
      const node = getNodeAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      if (!node && !panRef.current.active) selectNode(null);
    }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x: tx, y: ty, k } = transformRef.current;
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    const newK = Math.min(Math.max(k * factor, 0.2), 6);
    const ox = e.nativeEvent.offsetX;
    const oy = e.nativeEvent.offsetY;
    transformRef.current = {
      x: ox - (ox - tx) * (newK / k),
      y: oy - (oy - ty) * (newK / k),
      k: newK,
    };
  }, []);

  const zoomToFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || simNodesRef.current.length === 0) return;
    const nodes = simNodesRef.current;
    const w = canvas.width;
    const h = canvas.height;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const n of nodes) {
      if (n.x == null) continue;
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y!); maxY = Math.max(maxY, n.y!);
    }
    const pad = 80;
    const k = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1), 2.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    transformRef.current = { x: w / 2 - cx * k, y: h / 2 - cy * k, k };
  }, []);

  // ── Label breakdown for legend ──
  const labelCounts = data?.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.label] = (acc[n.label] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  // ── Sidebar neighbor list ──
  const neighborLinks = selectedNode
    ? simLinksRef.current.filter((l) => {
        const s = (l.source as GraphNode).id ?? l.source;
        const t = (l.target as GraphNode).id ?? l.target;
        return s === selectedNode.id || t === selectedNode.id;
      }).sort((a, b) => b.similarity - a.similarity)
    : [];

  // ── Render ──

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12 }}>
        <div style={{ width: 32, height: 32, border: "2px solid rgba(196,112,75,0.2)", borderTopColor: "#C4704B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "#A89B8C", fontSize: 13 }}>Building brain map…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
        <div style={{ padding: 48, textAlign: "center", border: "1px dashed rgba(196,112,75,0.2)", borderRadius: 16, color: "#A89B8C", fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◎</div>
          <strong style={{ color: "#EDE6DD" }}>No data yet</strong><br />
          The graph appears once you have training entries with embeddings.<br />
          Use the <a href="/internal/sandbox" style={{ color: "#C4704B" }}>Sandbox</a> to run your first verifications.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, marginBottom: 4 }}>Brain Map</h1>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>
            {data.meta.totalNodes} nodes · {data.meta.totalLinks} similarity edges
            {data.meta.nodesWithEmbedding < data.meta.totalNodes && (
              <span style={{ color: "#f97316" }}> · {data.meta.totalNodes - data.meta.nodesWithEmbedding} without embeddings</span>
            )}
          </p>
        </div>
        <button
          onClick={zoomToFit}
          style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.25)", color: "#C4704B", fontSize: 12, cursor: "pointer" }}
        >
          Zoom to fit
        </button>
      </div>

      {/* Canvas + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: selectedNode ? "1fr 300px" : "1fr", gap: 16, alignItems: "start" }}>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{ position: "relative", height: "calc(100vh - 210px)", minHeight: 480, borderRadius: 16, border: "1px solid rgba(196,112,75,0.12)", overflow: "hidden", background: "#0d0b09" }}
        >
          <canvas
            ref={canvasRef}
            style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { panRef.current.active = false; dragRef.current.node = null; }}
            onWheel={handleWheel}
          />

          {/* Legend */}
          <div style={{ position: "absolute", bottom: 20, left: 20, padding: "12px 16px", background: "rgba(13,11,9,0.85)", border: "1px solid rgba(196,112,75,0.12)", borderRadius: 10, backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Labels</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {Object.entries(LABEL_COLORS).map(([lbl, col]) => (
                <LegendDot key={lbl} color={col} label={`${LABEL_LABELS[lbl]} (${labelCounts[lbl] ?? 0})`} />
              ))}
            </div>
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(196,112,75,0.1)" }}>
              <div style={{ fontSize: 10, color: "#A89B8C" }}>Node size = consensus · Scroll to zoom</div>
            </div>
          </div>

          {/* Hover tooltip */}
          {hoverNode && !selectedNode && (
            <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(13,11,9,0.92)", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 8, padding: "8px 14px", maxWidth: 360, pointerEvents: "none", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: 11, color: LABEL_COLORS[hoverNode.label] ?? "#A89B8C", marginBottom: 3, fontWeight: 600 }}>
                {LABEL_LABELS[hoverNode.label] ?? hoverNode.label} · {hoverNode.consensusLevel}/5
              </div>
              <div style={{ fontSize: 12, color: "#C8BEB4", lineHeight: 1.5 }}>
                {hoverNode.milestoneText.slice(0, 100)}{hoverNode.milestoneText.length > 100 ? "…" : ""}
              </div>
            </div>
          )}

          {/* No edges notice */}
          {data.links.length === 0 && (
            <div style={{ position: "absolute", top: 16, right: 16, padding: "7px 14px", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8, fontSize: 11, color: "#eab308" }}>
              No similarity edges yet — add more entries
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        {selectedNode && (
          <div style={{ padding: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 210px)", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <Badge color={LABEL_COLORS[selectedNode.label] ?? "#A89B8C"}>
                {LABEL_LABELS[selectedNode.label] ?? selectedNode.label}
              </Badge>
              <button onClick={() => selectNode(null)} style={{ background: "none", border: "none", color: "#A89B8C", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Milestone</div>
              <p style={{ fontSize: 13, color: "#EDE6DD", lineHeight: 1.65, margin: 0 }}>{selectedNode.milestoneText}</p>
            </div>

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

            {selectedNode.fraudType && (
              <div style={{ padding: "10px 14px", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "#f97316", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Fraud type</div>
                <div style={{ fontSize: 13, color: "#EDE6DD" }}>{selectedNode.fraudType}</div>
              </div>
            )}

            {neighborLinks.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#C4704B", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                  Similar nodes ({neighborLinks.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {neighborLinks.map((link) => {
                    const srcId = (link.source as GraphNode).id ?? link.source as string;
                    const tgtId = (link.target as GraphNode).id ?? link.target as string;
                    const neighborId = srcId === selectedNode.id ? tgtId : srcId;
                    const neighbor = simNodesRef.current.find((n) => n.id === neighborId);
                    if (!neighbor) return null;
                    return (
                      <div
                        key={neighborId}
                        onClick={() => selectNode(neighbor)}
                        style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.1)", borderRadius: 8, cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.3)")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(196,112,75,0.1)")}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: LABEL_COLORS[neighbor.label] ?? "#A89B8C" }}>{neighbor.label}</span>
                          <span style={{ fontSize: 10, color: "#A89B8C" }}>{(link.similarity * 100).toFixed(0)}% similar</span>
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

            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid rgba(196,112,75,0.08)" }}>
              <div style={{ fontSize: 10, color: "rgba(168,155,140,0.35)", fontFamily: "monospace", wordBreak: "break-all" }}>{selectedNode.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
