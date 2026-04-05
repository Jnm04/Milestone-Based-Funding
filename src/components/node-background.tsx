"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
  isMilestone: boolean;
  pulsePhase: number;
}

interface Signal {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
}

export function NodeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const N = 110;
    const particles: Particle[] = Array.from({ length: N }, () => ({
      x:          Math.random() * window.innerWidth,
      y:          Math.random() * window.innerHeight,
      vx:         (Math.random() - 0.5) * 0.28,
      vy:         (Math.random() - 0.5) * 0.28,
      r:          Math.random() > 0.88 ? 2.5 + Math.random() * 1.5 : 0.7 + Math.random() * 1.1,
      opacity:    0.12 + Math.random() * 0.38,
      isMilestone: Math.random() > 0.88,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    const signals: Signal[] = [];
    let signalTimer = 0;

    function spawnSignal() {
      for (let attempt = 0; attempt < 30; attempt++) {
        const i = Math.floor(Math.random() * N);
        const j = Math.floor(Math.random() * N);
        if (i === j) continue;
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < 155) {
          signals.push({ fromIdx: i, toIdx: j, progress: 0, speed: 0.006 + Math.random() * 0.01 });
          return;
        }
      }
    }

    const onMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    let t = 0;

    const draw = () => {
      t += 0.016;
      signalTimer += 0.016;
      if (signalTimer > 2.2 && signals.length < 10) { spawnSignal(); signalTimer = 0; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Update + draw nodes ──────────────────────────
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0)             p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0)             p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // gentle mouse repulsion
        const mdx = p.x - mouse.x;
        const mdy = p.y - mouse.y;
        const md  = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md < 130 && md > 0) {
          const f = ((130 - md) / 130) * 0.7;
          p.x += (mdx / md) * f;
          p.y += (mdy / md) * f;
        }

        const po = p.isMilestone
          ? p.opacity + Math.sin(t * 1.4 + p.pulsePhase) * 0.18
          : p.opacity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,112,75,${Math.max(0, Math.min(1, po))})`;
        ctx.fill();

        // milestone glow halo
        if (p.isMilestone) {
          const gr = p.r * (3.5 + Math.sin(t * 1.4 + p.pulsePhase) * 0.6);
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
          grd.addColorStop(0, `rgba(196,112,75,${po * 0.25})`);
          grd.addColorStop(1, "rgba(196,112,75,0)");
          ctx.beginPath();
          ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
      }

      // ── Connections ──────────────────────────────────
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < 155) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(196,112,75,${(1 - d / 155) * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── Signal pulses ─────────────────────────────────
      for (let s = signals.length - 1; s >= 0; s--) {
        const sig = signals[s];
        sig.progress += sig.speed;
        if (sig.progress >= 1) { signals.splice(s, 1); continue; }

        const from = particles[sig.fromIdx];
        const to   = particles[sig.toIdx];
        const px   = from.x + (to.x - from.x) * sig.progress;
        const py   = from.y + (to.y - from.y) * sig.progress;

        // dot
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(212,184,150,0.85)";
        ctx.fill();

        // trail
        const t0   = Math.max(0, sig.progress - 0.06);
        const tx   = from.x + (to.x - from.x) * t0;
        const ty   = from.y + (to.y - from.y) * t0;
        const grd  = ctx.createLinearGradient(tx, ty, px, py);
        grd.addColorStop(0, "rgba(196,112,75,0)");
        grd.addColorStop(1, "rgba(212,184,150,0.55)");
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
