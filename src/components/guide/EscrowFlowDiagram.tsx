"use client";

import { motion } from "framer-motion";
import { FileText, UserCheck, Lock, Brain, Sparkles } from "lucide-react";

type FlowNode = {
  key: string;
  title: string;
  sub: string;
  icon: typeof FileText;
};

const nodes: FlowNode[] = [
  { key: "requester", title: "Requester", sub: "Creates contract", icon: FileText },
  { key: "builder", title: "Builder", sub: "Accepts invite", icon: UserCheck },
  { key: "escrow", title: "Escrow", sub: "RLUSD locked", icon: Lock },
  { key: "ai", title: "AI Vote", sub: "5-model consensus", icon: Brain },
  { key: "settle", title: "Settlement", sub: "Funds released", icon: Sparkles },
];

const edges = ["Invite", "Fund", "Proof", "Verify"];

const NODE_W = 150;
const NODE_H = 96;
const Y = 130;
const cx = [80, 290, 500, 710, 920];

export const EscrowFlowDiagram = () => {
  return (
    <div className="gradient-border relative overflow-hidden rounded-2xl bg-card/60 p-7 backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-6 bg-primary" />
          Escrow flow
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          live
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{ background: "radial-gradient(ellipse at center, hsl(22 70% 35% / 0.25), transparent 70%)" }}
      />

      <div className="hidden md:block">
        <svg viewBox="0 0 1000 260" className="h-auto w-full" role="img" aria-label="Escrow flow diagram">
          <defs>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(22 55% 54% / 0)" />
              <stop offset="20%" stopColor="hsl(22 55% 54% / 0.7)" />
              <stop offset="80%" stopColor="hsl(28 75% 70% / 0.7)" />
              <stop offset="100%" stopColor="hsl(28 75% 70% / 0)" />
            </linearGradient>
            <linearGradient id="nodeFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(24 14% 8%)" />
              <stop offset="100%" stopColor="hsl(24 14% 5%)" />
            </linearGradient>
            <linearGradient id="nodeStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(22 55% 54% / 0.6)" />
              <stop offset="100%" stopColor="hsl(28 75% 70% / 0.1)" />
            </linearGradient>
            <radialGradient id="particleGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(28 90% 75%)" stopOpacity="1" />
              <stop offset="60%" stopColor="hsl(22 80% 60%)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="hsl(22 80% 60%)" stopOpacity="0" />
            </radialGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edges.map((label, i) => {
            const x1 = cx[i] + NODE_W / 2;
            const x2 = cx[i + 1] - NODE_W / 2;
            const midX = (x1 + x2) / 2;
            return (
              <g key={label}>
                <line x1={x1} y1={Y} x2={x2} y2={Y} stroke="url(#edgeGrad)" strokeWidth={1.5} />
                <line x1={x1} y1={Y} x2={x2} y2={Y} stroke="hsl(28 75% 70% / 0.55)" strokeWidth={1} strokeDasharray="4 8" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="2.4s" repeatCount="indefinite" />
                </line>
                <circle r="6" fill="url(#particleGlow)" filter="url(#softGlow)">
                  <animate attributeName="cx" values={`${x1};${x2}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={`${Y};${Y}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                </circle>
                <g>
                  <rect x={midX - 28} y={Y - 68} width={56} height={18} rx={9} fill="hsl(24 14% 6%)" stroke="hsl(22 55% 54% / 0.5)" strokeWidth={1} />
                  <text x={midX} y={Y - 55} textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" letterSpacing="1.2" fontWeight={600} fill="hsl(28 90% 80%)" style={{ textTransform: "uppercase" }}>{label}</text>
                </g>
              </g>
            );
          })}

          {nodes.map((n, i) => {
            const x = cx[i] - NODE_W / 2;
            const y = Y - NODE_H / 2;
            return (
              <g key={n.key}>
                <rect x={x - 4} y={y - 4} width={NODE_W + 8} height={NODE_H + 8} rx={16} fill="none" stroke="hsl(22 75% 55%)" strokeWidth={1} opacity={0}>
                  <animate attributeName="opacity" values="0;0.7;0" dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="x" values={`${x - 2};${x - 8};${x - 2}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="y" values={`${y - 2};${y - 8};${y - 2}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="width" values={`${NODE_W + 4};${NODE_W + 16};${NODE_W + 4}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                  <animate attributeName="height" values={`${NODE_H + 4};${NODE_H + 16};${NODE_H + 4}`} dur="2.4s" begin={`${i * 0.55}s`} repeatCount="indefinite" />
                </rect>
                <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={14} fill="url(#nodeFill)" stroke="url(#nodeStroke)" strokeWidth={1} />
                <circle cx={x + 22} cy={y + 22} r={10} fill="hsl(22 55% 54% / 0.15)" stroke="hsl(22 55% 54% / 0.5)" strokeWidth={1} />
                <circle cx={x + 22} cy={y + 22} r={3} fill="hsl(28 90% 75%)" />
                <text x={x + 16} y={y + 56} fontSize="14" fontFamily="Inter Tight, system-ui, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">{n.title}</text>
                <text x={x + 16} y={y + 76} fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" fill="hsl(30 10% 62%)" style={{ textTransform: "uppercase" }}>{n.sub}</text>
                <text x={x + NODE_W - 14} y={y + 20} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" fill="hsl(28 75% 70% / 0.7)">0{i + 1}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-3 md:hidden">
        {nodes.map((n, i) => (
          <div key={n.key}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative overflow-hidden rounded-xl border border-border bg-background/40 px-4 py-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <n.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{n.title}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{n.sub}</div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary/70">0{i + 1}</span>
              </div>
            </motion.div>
            {i < nodes.length - 1 && (
              <div className="relative my-1 ml-[26px] h-6">
                <span className="absolute left-0 top-0 h-full w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" />
                <motion.span
                  className="absolute left-[-3px] h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{ top: ["0%", "100%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                />
                <span className="absolute left-3 top-1 font-mono text-[9px] uppercase tracking-[0.18em] text-primary/80">{edges[i]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
