"use client";

import { useEffect, useRef, useState } from "react";

/*
 * CinematicIntro — a position:fixed overlay that:
 *
 *  Phase 0  (0–500ms)   : dark screen, canvas traces begin converging
 *  Phase 1  (500ms)     : logo bars draw in (scaleX reveal, staggered)
 *  Phase 2  (1400ms)    : "cascrow" letters unfurl (blur + opacity, staggered)
 *  Phase 3  (2600ms)    : slogan rises
 *  Phase 4  (3600ms)    : scroll cue appears
 *
 *  Auto-resolve (5800ms trigger, 1400ms duration):
 *    - logo smoothly travels from center → nav position (easeInOutQuart)
 *    - background fades, overlay removed from DOM
 *    - dispatches 'cascrow:intro-done' for the nav to respond to
 *
 *  Scroll override (0–300px):
 *    - User can scroll at any time to trigger the exit earlier
 *    - Math.max(scrollProgress, autoProgress) ensures no regression
 */

const LETTERS = "cascrow".split("");

export function CinematicIntro() {
  const [phase, setPhase]             = useState(0);
  const [scrollY, setScrollY]         = useState(0);
  const [ww, setWw]                   = useState(0);
  const [wh, setWh]                   = useState(0);
  const [gone, setGone]               = useState(false);
  const [autoProgress, setAutoProgress] = useState(0);

  const traceCanvasRef = useRef<HTMLCanvasElement>(null);
  const traceAnimRef   = useRef<number>(0);

  // ── Window size ────────────────────────────────────────────
  useEffect(() => {
    const set = () => { setWw(window.innerWidth); setWh(window.innerHeight); };
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);

  // ── Phase sequencer ────────────────────────────────────────
  useEffect(() => {
    const ts = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1400),
      setTimeout(() => setPhase(3), 2600),
      setTimeout(() => setPhase(4), 3600),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);

  // ── Scroll tracking ────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrollY(y);
      if (y >= 300) setGone(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Auto-resolve: RAF-driven logo journey to nav ────────────
  useEffect(() => {
    const TRIGGER_MS  = 5800;  // after phase 4 + 2.2s hold
    const DURATION_MS = 1400;  // travel duration

    // easeInOutQuart — slow launch, smooth landing
    const ease = (t: number) =>
      t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    let rafId = 0;
    const timer = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const raw    = Math.min((now - start) / DURATION_MS, 1);
        const eased  = ease(raw);
        setAutoProgress(eased);

        if (raw < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          // Transition complete — hand off to nav logo
          setGone(true);
          document.querySelector<HTMLElement>("[data-nav-logo]")
            ?.style.setProperty("opacity", "1");
          window.dispatchEvent(new Event("cascrow:intro-done"));
        }
      };
      rafId = requestAnimationFrame(tick);
    }, TRIGGER_MS);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // ── Canvas: converging energy traces ──────────────────────
  useEffect(() => {
    if (phase < 1) return;
    const canvas = traceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const cx = canvas.width  / 2;
    const cy = canvas.height / 2 - 20;
    const minDim = Math.min(canvas.width, canvas.height);

    // 120 traces with wide radius range and varied speeds
    const traces = Array.from({ length: 120 }, (_, i) => {
      const angle = (i / 120) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist  = 180 + Math.random() * minDim * 0.52;
      return {
        sx:       cx + Math.cos(angle) * dist,
        sy:       cy + Math.sin(angle) * dist,
        ex:       cx + (Math.random() - 0.5) * 55,
        ey:       cy + (Math.random() - 0.5) * 55,
        progress: 0,
        speed:    0.003 + Math.random() * 0.014,  // wide spread — layered arrival
        alpha:    0.1 + Math.random() * 0.35,
        width:    0.4 + Math.random() * 1.0,
      };
    });

    let canvasAlpha  = 1;
    let fading       = false;
    let pulseFrames  = 0;
    let pulsing      = false;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (fading) {
        canvasAlpha = Math.max(0, canvasAlpha - 0.022);
        ctx.globalAlpha = canvasAlpha;
        if (canvasAlpha <= 0) return;
      }

      let allDone = true;
      for (const t of traces) {
        if (t.progress < 1) {
          t.progress = Math.min(1, t.progress + t.speed);
          allDone    = false;
        }

        const px = t.sx + (t.ex - t.sx) * t.progress;
        const py = t.sy + (t.ey - t.sy) * t.progress;

        // Pulse brightness before fade
        const drawAlpha = pulsing
          ? t.alpha * (1 + 0.4 * Math.sin((pulseFrames / 18) * Math.PI))
          : t.alpha;

        const grd = ctx.createLinearGradient(t.sx, t.sy, px, py);
        grd.addColorStop(0,   "rgba(196,112,75,0)");
        grd.addColorStop(0.6, `rgba(196,112,75,${drawAlpha * 0.5})`);
        grd.addColorStop(1,   `rgba(212,184,150,${drawAlpha})`);

        ctx.beginPath();
        ctx.moveTo(t.sx, t.sy);
        ctx.lineTo(px, py);
        ctx.strokeStyle = grd;
        ctx.lineWidth   = t.width;
        ctx.stroke();
      }

      if (allDone && !fading) {
        pulseFrames++;
        pulsing = pulseFrames <= 18;
        if (pulseFrames > 18) fading = true;
      }

      traceAnimRef.current = requestAnimationFrame(draw);
    };

    traceAnimRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(traceAnimRef.current);
  }, [phase]);

  if (gone) return null;

  // ── Combined position driver (scroll OR auto, whichever is further) ──
  const scrollProgress = Math.min(scrollY / 280, 1);
  const progress       = Math.max(scrollProgress, autoProgress);

  // Nav logo target (px from viewport edge)
  const navX = 96;
  const navY = 28;
  const cx   = ww / 2 || 600;
  const cy   = wh / 2 || 400;

  const logoX     = cx + (navX - cx) * progress;
  const logoY     = cy + (navY - cy) * progress;
  const logoScale = 1 - progress * 0.74;

  // Auto-resolve: logo travels at full opacity (bg fades instead)
  // Scroll-driven: logo fades as user scrolls
  const logoAlpha = scrollY > 0 ? Math.max(0, 1 - scrollProgress * 1.6) : 1;
  const bgAlpha   = Math.max(0, 1 - progress * 2.5);

  return (
    <>
      {/* Dark background layer */}
      <div
        style={{
          position:      "fixed",
          inset:         0,
          zIndex:        48,
          background:    "#171311",
          opacity:       bgAlpha,
          pointerEvents: "none",
          transition:    scrollY === 0 && autoProgress === 0 ? "none" : "opacity 0.05s linear",
        }}
      />

      {/* Trace canvas */}
      <canvas
        ref={traceCanvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          width:         "100%",
          height:        "100%",
          pointerEvents: "none",
          zIndex:        49,
          opacity:       phase >= 2 ? Math.max(0, 1 - (phase - 2) * 0.5) : 1,
          transition:    "opacity 1.4s ease",
        }}
      />

      {/* Logo */}
      <div
        style={{
          position:      "fixed",
          left:          logoX,
          top:           logoY,
          transform:     `translate(-50%, -50%) scale(${logoScale})`,
          opacity:       logoAlpha,
          zIndex:        50,
          pointerEvents: progress > 0.5 ? "none" : "none",
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          gap:           20,
          visibility:    ww === 0 ? "hidden" : "visible",
        }}
      >
        {/* ── 3 staggered bars ───────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 9, alignSelf: "flex-start" }}>
          {[
            { delay: 0,   ml: 0,  baseOpacity: 1    },
            { delay: 150, ml: 16, baseOpacity: 0.55 },
            { delay: 300, ml: 32, baseOpacity: 0.22 },
          ].map(({ delay, ml, baseOpacity }, idx) => (
            <div
              key={idx}
              style={{
                width:           80,
                height:          5,
                borderRadius:    3,
                background:      "#C4704B",
                marginLeft:      ml,
                opacity:         phase >= 1 ? baseOpacity : 0,
                transform:       phase >= 1 ? "scaleX(1)" : "scaleX(0)",
                transformOrigin: "left center",
                transition:      `transform 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity 0.5s ease ${delay}ms`,
              }}
            />
          ))}
        </div>

        {/* ── "cascrow" letterforms ──────────────────────── */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          {LETTERS.map((ch, i) => (
            <span
              key={i}
              style={{
                fontFamily:    "var(--font-libre-franklin), sans-serif",
                fontWeight:    300,
                fontSize:      52,
                lineHeight:    1,
                color:         "#EDE6DD",
                display:       "inline-block",
                opacity:       phase >= 2 ? 1 : 0,
                filter:        phase >= 2 ? "blur(0px)" : "blur(20px)",
                transform:     phase >= 2 ? "translateY(0)" : "translateY(28px)",
                letterSpacing: phase >= 2 ? "7px" : "24px",
                transition:    `opacity 0.75s ease ${i * 100}ms,
                                 filter 0.75s ease ${i * 100}ms,
                                 transform 0.75s ease ${i * 100}ms,
                                 letter-spacing 0.9s ease ${i * 100}ms`,
              }}
            >
              {ch}
            </span>
          ))}
          {/* Trailing spacer for last letter's letter-spacing */}
          <span style={{ display: "inline-block", width: 7 }} />
        </div>

        {/* ── Slogan ─────────────────────────────────────── */}
        <div
          style={{
            opacity:       phase >= 3 ? 1 : 0,
            transform:     phase >= 3 ? "translateY(0)" : "translateY(12px)",
            letterSpacing: phase >= 3 ? "0.28em" : "0.6em",
            transition:    "opacity 1.0s ease, transform 1.0s ease, letter-spacing 1.3s ease",
          }}
        >
          <span
            style={{
              fontFamily:    "var(--font-libre-franklin), sans-serif",
              fontWeight:    300,
              fontSize:      11,
              color:         "#A89B8C",
              textTransform: "uppercase",
            }}
          >
            proof unlocks funds
          </span>
        </div>

        {/* ── Scroll cue — hidden once auto-resolve begins ── */}
        <div
          style={{
            marginTop:     28,
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            gap:           6,
            opacity:       phase >= 4 && autoProgress === 0 ? 0.55 : 0,
            transition:    "opacity 0.9s ease",
            animation:     phase >= 4 && autoProgress === 0 ? "float 2.2s ease-in-out infinite" : "none",
          }}
        >
          <span
            style={{
              fontFamily:    "var(--font-libre-franklin), sans-serif",
              fontWeight:    300,
              fontSize:      9,
              color:         "#A89B8C",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
            }}
          >
            scroll
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A89B8C"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </>
  );
}
