"use client";

/**
 * BrainGraph3D — Three.js / React Three Fiber 3D force-directed graph.
 * Dynamically imported from page.tsx (ssr: false).
 * No AFRAME, no react-force-graph — pure Three.js + d3-force-3d.
 */

import { useRef, useEffect, useState, useMemo, useCallback, MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere, Billboard, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
// d3-force-3d has no official types — use require to bypass TS
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } = require("d3-force-3d") as any;
import type { GraphData, GraphNode, GraphLink } from "./page";

// Re-import the colours here so this file is self-contained at runtime
const LABEL_COLORS: Record<string, string> = {
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  FAKED:    "#f97316",
  PENDING:  "#eab308",
};

function nodeRadius(n: GraphNode) { return 0.38 + n.consensusLevel * 0.14; }

// ─── Node sphere ──────────────────────────────────────────────────────────────

interface NodeMeshProps {
  node: GraphNode;
  isSelected: boolean;
  isHighlighted: boolean;
  hasSelection: boolean;
  onSelect: (n: GraphNode) => void;
  onHover: (n: GraphNode | null, x?: number, y?: number) => void;
}

function NodeMesh({ node, isSelected, isHighlighted, hasSelection, onSelect, onHover }: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const color   = LABEL_COLORS[node.label] ?? "#A89B8C";
  const radius  = nodeRadius(node);

  // Smoothly move the mesh to the sim position every frame
  useFrame(() => {
    if (!meshRef.current || node.x == null) return;
    meshRef.current.position.lerp(new THREE.Vector3(node.x, node.y ?? 0, node.z ?? 0), 0.12);
    if (glowRef.current) glowRef.current.position.copy(meshRef.current.position);
  });

  const opacity    = hasSelection && !isHighlighted ? 0.08 : 1;
  const emissive   = isSelected ? 1.8 : isHighlighted ? 1.0 : 0.5;
  const glowScale  = isSelected ? 3.2 : 2.2;
  const glowOpac   = isSelected ? 0.18 : 0.08;

  return (
    <>
      {/* Glow halo — additive blending billboard sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * glowScale, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={hasSelection && !isHighlighted ? 0.01 : glowOpac} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(node); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node, e.clientX, e.clientY); document.body.style.cursor = "pointer"; }}
        onPointerMove={(e) => { onHover(node, e.clientX, e.clientY); }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissive}
          roughness={0.25}
          metalness={0.15}
          transparent
          opacity={opacity}
        />
      </mesh>
    </>
  );
}

// ─── Edge line ────────────────────────────────────────────────────────────────

function EdgeLine({ link, isHighlighted, hasSelection }: { link: GraphLink; isHighlighted: boolean; hasSelection: boolean }) {
  const geomRef = useRef<THREE.BufferGeometry>(null!);

  useFrame(() => {
    const src = link.source as GraphNode;
    const tgt = link.target as GraphNode;
    if (!geomRef.current || src.x == null || tgt.x == null) return;
    const pos = geomRef.current.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, src.x, src.y ?? 0, src.z ?? 0);
    pos.setXYZ(1, tgt.x, tgt.y ?? 0, tgt.z ?? 0);
    pos.needsUpdate = true;
  });

  const opacity = hasSelection ? (isHighlighted ? 0.6 : 0.02) : 0.14 + link.similarity * 0.1;
  const color   = isHighlighted ? "#C4704B" : "#3a2e28";

  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" count={2} itemSize={3} args={[new Float32Array(6), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </line>
  );
}

// ─── Camera reset helper ──────────────────────────────────────────────────────

function CameraReset({ resetRef }: { resetRef: MutableRefObject<() => void> }) {
  const { camera } = useThree();
  const controlsRef = useRef<{ reset: () => void; target: THREE.Vector3 }>(null!);

  useEffect(() => {
    resetRef.current = () => {
      camera.position.set(0, 0, 180);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.reset();
      }
    };
  }, [camera, resetRef]);

  return (
    <OrbitControls
      ref={controlsRef as never}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minDistance={10}
      maxDistance={400}
    />
  );
}

// ─── Scene contents ───────────────────────────────────────────────────────────

interface SceneProps {
  data: GraphData;
  selectedId: string | null;
  onSelect: (n: GraphNode) => void;
  resetRef: MutableRefObject<() => void>;
  onHoverChange?: (node: GraphNode | null, x: number, y: number) => void;
}

function Scene({ data, selectedId, onSelect, resetRef, onHoverChange }: SceneProps) {
  const [hover, setHover] = useState<GraphNode | null>(null);
  const simDone = useRef(false);

  // Deep-clone nodes & links so d3 can mutate them
  const simNodes = useMemo<GraphNode[]>(() => data.nodes.map(n => ({ ...n })), [data]);
  const simLinks = useMemo<GraphLink[]>(() => data.links.map(l => ({ ...l, source: l.source as string, target: l.target as string })), [data]);

  useEffect(() => {
    simDone.current = false;

    const sim = forceSimulation(simNodes, 3)           // 3 = 3D
      .force("link",      forceLink(simLinks).id((d: GraphNode) => d.id).distance(55).strength(0.5))
      .force("charge",    forceManyBody().strength(-120))
      .force("center",    forceCenter(0, 0, 0))
      .force("collision", forceCollide((d: GraphNode) => nodeRadius(d) * 6))
      .alphaDecay(0.022)
      .velocityDecay(0.38)
      .stop();

    // Run synchronously for 200 ticks then let useFrame do the rest live
    for (let i = 0; i < 200; i++) sim.tick();
    simDone.current = true;
    sim.alphaTarget(0).restart();

    return () => sim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Highlight logic ──
  const neighborIds = useMemo<Set<string>>(() => {
    if (!selectedId) return new Set();
    const ids = new Set<string>([selectedId]);
    for (const l of simLinks) {
      const s = (l.source as GraphNode).id ?? l.source as string;
      const t = (l.target as GraphNode).id ?? l.target as string;
      if (s === selectedId) ids.add(t);
      if (t === selectedId) ids.add(s);
    }
    return ids;
  }, [selectedId, simLinks]);

  const hasSelection = neighborIds.size > 0;

  const handleSelect = useCallback((n: GraphNode) => {
    onSelect(n.id === selectedId ? ({ ...n, id: "__deselect__" } as unknown as GraphNode) : n);
  }, [selectedId, onSelect]);

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[100, 100, 100]} intensity={0.8} />
      <pointLight position={[-100, -100, -100]} intensity={0.4} />

      <CameraReset resetRef={resetRef} />

      {/* Edges */}
      {simLinks.map((link, i) => {
        const s = (link.source as GraphNode).id ?? link.source as string;
        const t = (link.target as GraphNode).id ?? link.target as string;
        const isHighlighted = hasSelection && (neighborIds.has(s) && neighborIds.has(t));
        return (
          <EdgeLine key={i} link={link} isHighlighted={isHighlighted} hasSelection={hasSelection} />
        );
      })}

      {/* Nodes */}
      {simNodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={node.id === selectedId}
          isHighlighted={!hasSelection || neighborIds.has(node.id)}
          hasSelection={hasSelection}
          onSelect={handleSelect}
          onHover={(n, x, y) => {
            setHover(n);
            onHoverChange?.(n, x ?? 0, y ?? 0);
          }}
        />
      ))}

      {/* Bloom glow post-processing */}
      <EffectComposer>
        <Bloom
          intensity={1.4}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

interface BrainGraph3DProps {
  data: GraphData;
  selectedId: string | null;
  onNodeSelect: (n: GraphNode | null) => void;
  onResetRef: MutableRefObject<() => void>;
  onNodeHover?: (node: GraphNode | null, x: number, y: number) => void;
}

export default function BrainGraph3D({ data, selectedId, onNodeSelect, onResetRef, onNodeHover }: BrainGraph3DProps) {
  const handleSelect = useCallback((n: GraphNode) => {
    if ((n as unknown as { id: string }).id === "__deselect__") {
      onNodeSelect(null);
    } else {
      onNodeSelect(n.id === selectedId ? null : n);
    }
  }, [selectedId, onNodeSelect]);

  return (
    <Canvas
      camera={{ position: [0, 0, 180], fov: 50 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#060504" }}
    >
      <Scene
        data={data}
        selectedId={selectedId}
        onSelect={handleSelect}
        resetRef={onResetRef}
        onHoverChange={onNodeHover}
      />
    </Canvas>
  );
}
