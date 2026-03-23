"use client";

import { useEffect, useRef, useCallback } from "react";

interface Props {
  density?: "high" | "medium" | "low";
  interactive?: boolean;
  className?: string;
}

interface NodeData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  naturalVx: number;
  naturalVy: number;
  radius: number;
  baseOpacity: number;
  opacity: number;
  pulseTimer: number;
  pulseScale: number;
}

interface Pulse {
  from: number;
  to: number;
  progress: number;
  duration: number;
}

const NODE_COUNTS = {
  high:   { desktop: 45, mobile: 25 },
  medium: { desktop: 28, mobile: 15 },
  low:    { desktop: 18, mobile: 10 },
} as const;

const MAX_DIST       = 150;
const CURSOR_DIST    = 120;
const REPEL_STRENGTH = 1.8;
const MAX_PULSES     = 2;
const R = 196, G = 112, B = 75;   // #C4704B
const RP = 212, GP = 184, BP = 150; // #D4B896

export default function NetworkBackground({ density = "medium", interactive = true, className }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const nodesRef        = useRef<NodeData[]>([]);
  const pulsesRef       = useRef<Pulse[]>([]);
  const mouseRef        = useRef({ x: -9999, y: -9999 });
  const dashOffsetRef   = useRef(0);
  const lastTimeRef     = useRef(-1);
  const pulseTimerRef   = useRef(Math.random() * 2000 + 3000);
  const reducedMotion   = useRef(false);

  const initNodes = useCallback((w: number, h: number, count: number) => {
    const nodes: NodeData[] = [];
    for (let i = 0; i < count; i++) {
      const speed = Math.random() * 0.3 + 0.15;
      const angle = Math.random() * Math.PI * 2;
      const nvx   = Math.cos(angle) * speed;
      const nvy   = Math.sin(angle) * speed;
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: nvx, vy: nvy,
        naturalVx: nvx, naturalVy: nvy,
        radius:      Math.random() * 1.5 + 1.5,
        baseOpacity: Math.random() * 0.5 + 0.3,
        opacity:     Math.random() * 0.5 + 0.3,
        pulseTimer:  0,
        pulseScale:  1,
      });
    }
    nodesRef.current  = nodes;
    pulsesRef.current = [];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const isMobile = window.innerWidth < 768;
    const count    = NODE_COUNTS[density][isMobile ? "mobile" : "desktop"];

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes(canvas.width, canvas.height, count);
    };
    resize();

    // ── Mouse / touch tracking ──────────────────────────────────────────────
    const onMouseMove  = (e: MouseEvent)     => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onTouchMove  = (e: TouchEvent)     => {
      if (e.touches[0]) mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const onMouseLeave = ()                  => { mouseRef.current = { x: -9999, y: -9999 }; };

    if (interactive) {
      window.addEventListener("mousemove",  onMouseMove);
      window.addEventListener("touchmove",  onTouchMove,  { passive: true });
      window.addEventListener("mouseleave", onMouseLeave);
    }
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Main animation loop ─────────────────────────────────────────────────
    const draw = (time: number) => {
      if (lastTimeRef.current < 0) {
        lastTimeRef.current = time;
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const dt    = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;

      const nodes = nodesRef.current;
      const w     = canvas.width;
      const h     = canvas.height;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      if (!reducedMotion.current) {
        dashOffsetRef.current = (dashOffsetRef.current + dt * 0.018) % 20;

        // ── Update nodes ───────────────────────────────────────────────────
        for (const node of nodes) {
          // Drift back toward natural velocity
          node.vx = node.vx * 0.97 + node.naturalVx * 0.03;
          node.vy = node.vy * 0.97 + node.naturalVy * 0.03;

          // Mouse repulsion
          if (interactive) {
            const dx   = node.x - mouse.x;
            const dy   = node.y - mouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < CURSOR_DIST && dist > 1) {
              const force = (1 - dist / CURSOR_DIST) * REPEL_STRENGTH * (dt / 16);
              node.vx += (dx / dist) * force * 0.06;
              node.vy += (dy / dist) * force * 0.06;
            }

            // Pulse on hover
            if (dist < 15 && node.pulseTimer <= 0) {
              node.pulseTimer = 500;
            }
          }

          // Speed cap
          const spd = Math.hypot(node.vx, node.vy);
          if (spd > 3.5) { node.vx *= 3.5 / spd; node.vy *= 3.5 / spd; }

          // Move
          node.x += node.vx * (dt / 16);
          node.y += node.vy * (dt / 16);

          // Wrap around
          if (node.x < -8) node.x = w + 8;
          if (node.x > w + 8) node.x = -8;
          if (node.y < -8) node.y = h + 8;
          if (node.y > h + 8) node.y = -8;

          // Pulse animation
          if (node.pulseTimer > 0) {
            node.pulseTimer -= dt;
            const t = 1 - node.pulseTimer / 500;
            if (t < 0.5) {
              node.pulseScale = 1 + t * 1.0;
              node.opacity    = node.baseOpacity + t * (1 - node.baseOpacity);
            } else {
              node.pulseScale = 1 + (1 - t) * 1.0;
              node.opacity    = node.baseOpacity + (1 - t) * (1 - node.baseOpacity);
            }
          } else {
            node.pulseScale = 1;
            node.opacity    = node.baseOpacity;
          }
        }

        // ── Spawn traveling pulses ─────────────────────────────────────────
        pulseTimerRef.current -= dt;
        if (pulseTimerRef.current <= 0 && pulsesRef.current.length < MAX_PULSES) {
          pulseTimerRef.current = Math.random() * 2000 + 3000;
          const candidates: [number, number][] = [];
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              if (Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) < MAX_DIST) {
                candidates.push([i, j]);
              }
            }
          }
          if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            pulsesRef.current.push({ from: pick[0], to: pick[1], progress: 0, duration: 1500 });
          }
        }

        // Advance pulses
        pulsesRef.current = pulsesRef.current.filter(p => {
          p.progress += dt / p.duration;
          return p.progress < 1;
        });
      }

      // ── Draw connections ───────────────────────────────────────────────────
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -dashOffsetRef.current;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.22;
            ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
            ctx.lineWidth   = 0.7;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.restore();

      // ── Cursor connection lines ────────────────────────────────────────────
      if (interactive && mouse.x > -999) {
        const nearest = [...nodes]
          .map((n, i) => ({ i, dist: Math.hypot(n.x - mouse.x, n.y - mouse.y) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 4);
        ctx.save();
        ctx.setLineDash([]);
        for (const { i, dist } of nearest) {
          if (dist < MAX_DIST * 1.3) {
            const alpha = (1 - dist / (MAX_DIST * 1.3)) * 0.45;
            ctx.strokeStyle = `rgba(${R},${G},${B},${alpha})`;
            ctx.lineWidth   = 0.9;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(nodes[i].x, nodes[i].y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // ── Draw nodes ─────────────────────────────────────────────────────────
      for (const node of nodes) {
        ctx.save();
        ctx.globalAlpha = node.opacity;
        ctx.fillStyle   = `rgb(${R},${G},${B})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * node.pulseScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ── Traveling pulses ───────────────────────────────────────────────────
      for (const pulse of pulsesRef.current) {
        const from = nodes[pulse.from];
        const to   = nodes[pulse.to];
        if (!from || !to) continue;

        const px = from.x + (to.x - from.x) * pulse.progress;
        const py = from.y + (to.y - from.y) * pulse.progress;
        const trailP  = Math.max(0, pulse.progress - 0.18);
        const tx = from.x + (to.x - from.x) * trailP;
        const ty = from.y + (to.y - from.y) * trailP;

        const gradient = ctx.createLinearGradient(tx, ty, px, py);
        gradient.addColorStop(0, `rgba(${RP},${GP},${BP},0)`);
        gradient.addColorStop(1, `rgba(${RP},${GP},${BP},0.65)`);

        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = gradient;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.globalAlpha = 0.9;
        ctx.fillStyle   = `rgb(${RP},${GP},${BP})`;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize",     resize);
      if (interactive) {
        window.removeEventListener("mousemove",  onMouseMove);
        window.removeEventListener("touchmove",  onTouchMove);
        window.removeEventListener("mouseleave", onMouseLeave);
      }
    };
  }, [density, interactive, initNodes]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position:      "fixed",
        inset:         0,
        width:         "100%",
        height:        "100%",
        zIndex:        0,
        pointerEvents: "none",
      }}
    />
  );
}
