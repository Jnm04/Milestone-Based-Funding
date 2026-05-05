"use client";

import { motion } from "framer-motion";

export const DualChainDiagram = () => {
  return (
    <div className="gradient-border relative overflow-hidden rounded-2xl bg-card/60 p-7 backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-6 bg-primary" />
          Dual-chain architecture
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          on-chain · auditable
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{ background: "radial-gradient(ellipse at center, hsl(22 70% 35% / 0.25), transparent 70%)" }}
      />

      <div className="hidden md:block">
        <svg viewBox="0 0 1000 320" className="h-auto w-full" role="img" aria-label="Dual-chain architecture">
          <defs>
            <linearGradient id="evmFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(220 50% 14%)" />
              <stop offset="100%" stopColor="hsl(220 50% 8%)" />
            </linearGradient>
            <linearGradient id="evmStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(220 70% 60% / 0.7)" />
              <stop offset="100%" stopColor="hsl(220 70% 60% / 0.1)" />
            </linearGradient>
            <linearGradient id="cascFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(24 14% 9%)" />
              <stop offset="100%" stopColor="hsl(24 14% 5%)" />
            </linearGradient>
            <linearGradient id="cascStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(22 75% 60% / 0.8)" />
              <stop offset="100%" stopColor="hsl(28 75% 70% / 0.2)" />
            </linearGradient>
            <linearGradient id="xrplFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(140 40% 12%)" />
              <stop offset="100%" stopColor="hsl(140 40% 7%)" />
            </linearGradient>
            <linearGradient id="xrplStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(140 60% 55% / 0.7)" />
              <stop offset="100%" stopColor="hsl(140 60% 55% / 0.1)" />
            </linearGradient>
            <linearGradient id="leftEdge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(220 70% 60% / 0)" />
              <stop offset="50%" stopColor="hsl(22 70% 60% / 0.7)" />
              <stop offset="100%" stopColor="hsl(22 70% 60% / 0)" />
            </linearGradient>
            <linearGradient id="rightEdge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(22 70% 60% / 0)" />
              <stop offset="50%" stopColor="hsl(140 60% 55% / 0.7)" />
              <stop offset="100%" stopColor="hsl(140 60% 55% / 0)" />
            </linearGradient>
            <radialGradient id="orangeParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(28 90% 75%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(22 80% 60%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blueParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(220 90% 80%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(220 70% 60%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="greenParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(140 80% 80%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(140 60% 55%)" stopOpacity="0" />
            </radialGradient>
            <filter id="dcGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* EVM <-> Cascrow */}
          <line x1="240" y1="160" x2="400" y2="160" stroke="url(#leftEdge)" strokeWidth="1.5" />
          <line x1="240" y1="160" x2="400" y2="160" stroke="hsl(28 75% 70% / 0.5)" strokeWidth="1" strokeDasharray="4 8" strokeLinecap="round">
            <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="2.4s" repeatCount="indefinite" />
          </line>
          <circle r="5" fill="url(#blueParticle)" filter="url(#dcGlow)">
            <animate attributeName="cx" values="240;400" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="cy" values="160;160" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle r="5" fill="url(#orangeParticle)" filter="url(#dcGlow)">
            <animate attributeName="cx" values="400;240" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="cy" values="160;160" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin="1.2s" repeatCount="indefinite" />
          </circle>
          <text x="320" y="146" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70% / 0.85)" style={{ textTransform: "uppercase" }}>fund / release</text>

          {/* Cascrow <-> XRPL Mainnet */}
          <line x1="600" y1="160" x2="760" y2="160" stroke="url(#rightEdge)" strokeWidth="1.5" />
          <line x1="600" y1="160" x2="760" y2="160" stroke="hsl(28 75% 70% / 0.5)" strokeWidth="1" strokeDasharray="4 8" strokeLinecap="round">
            <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="2.4s" repeatCount="indefinite" />
          </line>
          <circle r="5" fill="url(#orangeParticle)" filter="url(#dcGlow)">
            <animate attributeName="cx" values="600;760" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
            <animate attributeName="cy" values="160;160" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin="0.6s" repeatCount="indefinite" />
          </circle>
          <circle r="5" fill="url(#greenParticle)" filter="url(#dcGlow)">
            <animate attributeName="cx" values="760;600" dur="2.4s" begin="1.8s" repeatCount="indefinite" />
            <animate attributeName="cy" values="160;160" dur="2.4s" begin="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin="1.8s" repeatCount="indefinite" />
          </circle>
          <text x="680" y="146" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70% / 0.85)" style={{ textTransform: "uppercase" }}>mint NFT / audit</text>

          {/* EVM card */}
          <g>
            <rect x="40" y="80" width="200" height="160" rx="14" fill="url(#evmFill)" stroke="url(#evmStroke)" />
            <text x="56" y="108" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(220 70% 75%)" style={{ textTransform: "uppercase" }}>XRPL EVM Sidechain</text>
            <text x="56" y="138" fontSize="14" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">MilestoneFundEscrow.sol</text>
            <text x="56" y="166" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· RLUSD (ERC-20)</text>
            <text x="56" y="186" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· MetaMask compatible</text>
            <text x="56" y="206" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· Chain ID 1449000</text>
            <circle cx="220" cy="100" r="3" fill="hsl(220 90% 70%)">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Cascrow center card */}
          <g>
            <rect x="400" y="80" width="200" height="160" rx="14" fill="url(#cascFill)" stroke="url(#cascStroke)" />
            <rect x="396" y="76" width="208" height="168" rx="16" fill="none" stroke="hsl(22 75% 55%)" strokeWidth="1" opacity="0">
              <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" />
            </rect>
            <text x="416" y="108" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70%)" style={{ textTransform: "uppercase" }}>cascrow</text>
            <text x="416" y="138" fontSize="14" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">Verification engine</text>
            <text x="416" y="166" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· 5-model AI quorum</text>
            <text x="416" y="186" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· Escrow logic</text>
            <text x="416" y="206" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· PostgreSQL · Upstash</text>
            <circle cx="580" cy="100" r="3" fill="hsl(28 90% 75%)">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* XRPL Mainnet card */}
          <g>
            <rect x="760" y="80" width="200" height="160" rx="14" fill="url(#xrplFill)" stroke="url(#xrplStroke)" />
            <text x="776" y="108" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(140 60% 70%)" style={{ textTransform: "uppercase" }}>XRPL Mainnet</text>
            <text x="776" y="138" fontSize="14" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">NFTokenMint</text>
            <text x="776" y="166" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· Non-transferable cert</text>
            <text x="776" y="186" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· AccountSet audit memos</text>
            <text x="776" y="206" fontSize="11" fontFamily="Inter Tight, sans-serif" fill="hsl(30 10% 70%)">· s1.ripple.com · mainnet</text>
            <circle cx="940" cy="100" r="3" fill="hsl(140 80% 70%)">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          <text x="140" y="270" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" fill="hsl(30 10% 55%)">Chain ID 1449000 · testnet</text>
          <text x="500" y="270" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" fill="hsl(30 10% 55%)">Vercel · PostgreSQL · Upstash</text>
          <text x="860" y="270" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.5" fill="hsl(30 10% 55%)">s1.ripple.com · mainnet</text>
        </svg>
      </div>

      <div className="space-y-3 md:hidden">
        {[
          { label: "XRPL EVM Sidechain", title: "MilestoneFundEscrow.sol", lines: ["RLUSD (ERC-20)", "MetaMask compatible", "Chain ID 1449000"], color: "hsl(220 70% 75%)" },
          { label: "cascrow", title: "Verification engine", lines: ["5-model AI quorum", "Escrow logic", "PostgreSQL · Upstash"], color: "hsl(28 75% 70%)" },
          { label: "XRPL Mainnet", title: "NFTokenMint", lines: ["Non-transferable cert", "AccountSet audit memos", "s1.ripple.com · mainnet"], color: "hsl(140 60% 70%)" },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className="rounded-xl border border-border bg-background/40 p-4"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: c.color }}>{c.label}</div>
            <div className="mt-2 text-sm font-semibold text-foreground">{c.title}</div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {c.lines.map((l) => <li key={l}>· {l}</li>)}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
