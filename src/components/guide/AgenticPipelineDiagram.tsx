"use client";

import { motion } from "framer-motion";

export const AgenticPipelineDiagram = () => {
  return (
    <div className="gradient-border relative overflow-hidden rounded-2xl bg-card/60 p-7 backdrop-blur-md">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-6 bg-primary" />
          Agentic pipeline
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          autonomous · 3-5s
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-50"
        style={{ background: "radial-gradient(ellipse at center, hsl(28 70% 35% / 0.28), transparent 70%)" }}
      />

      <div className="hidden md:block">
        <svg viewBox="0 0 1060 475" className="h-auto w-full" role="img" aria-label="Agentic pipeline">
          <defs>
            <linearGradient id="apInputFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(280 35% 14%)" />
              <stop offset="100%" stopColor="hsl(280 35% 8%)" />
            </linearGradient>
            <linearGradient id="apInputStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(280 70% 70% / 0.7)" />
              <stop offset="100%" stopColor="hsl(280 70% 70% / 0.1)" />
            </linearGradient>
            <linearGradient id="apModelFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(24 14% 9%)" />
              <stop offset="100%" stopColor="hsl(24 14% 5%)" />
            </linearGradient>
            <linearGradient id="apModelStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(22 75% 60% / 0.7)" />
              <stop offset="100%" stopColor="hsl(28 75% 70% / 0.15)" />
            </linearGradient>
            <linearGradient id="apOutFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(140 40% 12%)" />
              <stop offset="100%" stopColor="hsl(140 40% 7%)" />
            </linearGradient>
            <linearGradient id="apOutStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(140 60% 55% / 0.7)" />
              <stop offset="100%" stopColor="hsl(140 60% 55% / 0.1)" />
            </linearGradient>
            <radialGradient id="apPurpleParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(280 90% 80%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(280 70% 60%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="apOrangeParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(28 90% 75%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(22 80% 60%)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="apGreenParticle" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(140 80% 80%)" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(140 60% 55%)" stopOpacity="0" />
            </radialGradient>
            <filter id="apGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="apStrongGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* INPUTS */}
          {[
            { y: 90, label: "MCP", sub: "claude code · npx" },
            { y: 200, label: "REST API", sub: "POST /api/mcp/submit" },
            { y: 310, label: "CLI", sub: "cascrow-cli · CI" },
          ].map((inp, i) => (
            <g key={inp.label}>
              <rect x="20" y={inp.y} width="170" height="90" rx="12" fill="url(#apInputFill)" stroke="url(#apInputStroke)" />
              <text x="105" y={inp.y + 28} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(280 70% 80%)" style={{ textTransform: "uppercase" }}>Input · 0{i + 1}</text>
              <text x="105" y={inp.y + 52} textAnchor="middle" fontSize="14" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">{inp.label}</text>
              <text x="105" y={inp.y + 72} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.2" fill="hsl(30 10% 65%)">{inp.sub}</text>
              <circle cx="174" cy={inp.y + 14} r="2.5" fill="hsl(280 90% 75%)">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}

          {/* Router */}
          <g>
            <rect x="270" y="200" width="100" height="60" rx="10" fill="url(#apModelFill)" stroke="url(#apModelStroke)" />
            <text x="320" y="226" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70%)" style={{ textTransform: "uppercase" }}>router</text>
            <text x="320" y="246" textAnchor="middle" fontSize="11" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">evidence</text>
          </g>

          {/* Input -> router */}
          {[135, 245, 355].map((srcY, i) => {
            const path = `M 190 ${srcY} C 240 ${srcY}, 240 230, 270 230`;
            return (
              <g key={`in-${i}`}>
                <path d={path} fill="none" stroke="hsl(280 70% 70% / 0.35)" strokeWidth="1.2" />
                <path d={path} fill="none" stroke="hsl(280 90% 80% / 0.7)" strokeWidth="1" strokeDasharray="3 7" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2.2s" repeatCount="indefinite" />
                </path>
                <circle r="4.5" fill="url(#apPurpleParticle)" filter="url(#apGlow)">
                  <animateMotion dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" path={path} />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          {/* 5-model quorum */}
          {[
            { y: 50, name: "Claude", vendor: "anthropic" },
            { y: 130, name: "GPT-4o", vendor: "openai" },
            { y: 210, name: "Gemini", vendor: "google" },
            { y: 290, name: "Mistral", vendor: "mistral" },
            { y: 370, name: "Cerebras", vendor: "cerebras" },
          ].map((m, i) => (
            <g key={m.name}>
              <path d={`M 370 230 C 440 230, 440 ${m.y + 30}, 480 ${m.y + 30}`} fill="none" stroke="hsl(22 55% 54% / 0.3)" strokeWidth="1" />
              <path d={`M 370 230 C 440 230, 440 ${m.y + 30}, 480 ${m.y + 30}`} fill="none" stroke="hsl(28 75% 70% / 0.6)" strokeWidth="1" strokeDasharray="3 7" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite" />
              </path>
              <rect x="480" y={m.y} width="160" height="60" rx="10" fill="url(#apModelFill)" stroke="url(#apModelStroke)" />
              <rect x="476" y={m.y - 4} width="168" height="68" rx="12" fill="none" stroke="hsl(22 75% 55%)" opacity="0">
                <animate attributeName="opacity" values="0;0.6;0" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
              </rect>
              <text x="496" y={m.y + 22} fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="1.8" fill="hsl(28 75% 70% / 0.85)" style={{ textTransform: "uppercase" }}>{m.vendor}</text>
              <text x="496" y={m.y + 42} fontSize="13" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">{m.name}</text>
              <g>
                {[0, 1, 2].map((d) => (
                  <circle key={d} cx={612 + d * 8} cy={m.y + 30} r="2" fill="hsl(28 90% 75%)">
                    <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin={`${i * 0.15 + d * 0.2}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
              <path d={`M 640 ${m.y + 30} C 680 ${m.y + 30}, 680 230, 720 230`} fill="none" stroke="hsl(22 55% 54% / 0.3)" strokeWidth="1" />
              <path d={`M 640 ${m.y + 30} C 680 ${m.y + 30}, 680 230, 720 230`} fill="none" stroke="hsl(28 75% 70% / 0.6)" strokeWidth="1" strokeDasharray="3 7" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite" />
              </path>
              <circle r="3.5" fill="url(#apOrangeParticle)" filter="url(#apGlow)">
                <animateMotion dur="2s" begin={`${1.2 + i * 0.12}s`} repeatCount="indefinite" path={`M 640 ${m.y + 30} C 680 ${m.y + 30}, 680 230, 720 230`} />
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2s" begin={`${1.2 + i * 0.12}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}

          <text x="560" y="20" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2.5" fill="hsl(28 75% 70%)" style={{ textTransform: "uppercase" }}>5-model quorum · parallel</text>

          {/* Consensus node */}
          <g>
            <rect x="720" y="200" width="80" height="60" rx="10" fill="url(#apModelFill)" stroke="url(#apModelStroke)" />
            <text x="760" y="226" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70%)" style={{ textTransform: "uppercase" }}>consensus</text>
            <text x="760" y="246" textAnchor="middle" fontSize="11" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">≥ 85%</text>
          </g>

          {/* Outputs */}
          {[
            { y: 90, label: "RLUSD released", sub: "XRPL EVM · 3-5s" },
            { y: 200, label: "NFT cert minted", sub: "XRPL Mainnet" },
            { y: 310, label: "Webhook fired", sub: "funds.released" },
          ].map((out, i) => {
            const targetY = out.y + 45;
            const path = `M 800 230 C 840 230, 840 ${targetY}, 880 ${targetY}`;
            return (
              <g key={out.label}>
                <path d={path} fill="none" stroke="hsl(140 60% 55% / 0.35)" strokeWidth="1.2" />
                <path d={path} fill="none" stroke="hsl(140 80% 75% / 0.7)" strokeWidth="1" strokeDasharray="3 7" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2.2s" repeatCount="indefinite" />
                </path>
                <circle r="4.5" fill="url(#apGreenParticle)" filter="url(#apStrongGlow)">
                  <animateMotion dur="2.4s" begin={`${2.4 + i * 0.3}s`} repeatCount="indefinite" path={path} />
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.4s" begin={`${2.4 + i * 0.3}s`} repeatCount="indefinite" />
                </circle>
                <rect x="880" y={out.y} width="170" height="90" rx="12" fill="url(#apOutFill)" stroke="url(#apOutStroke)" />
                <text x="965" y={out.y + 28} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(140 60% 70%)" style={{ textTransform: "uppercase" }}>out · 0{i + 1}</text>
                <text x="965" y={out.y + 52} textAnchor="middle" fontSize="14" fontFamily="Inter Tight, sans-serif" fontWeight={600} fill="hsl(32 35% 92%)">{out.label}</text>
                <text x="965" y={out.y + 72} textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" letterSpacing="1.2" fill="hsl(30 10% 65%)">{out.sub}</text>
                <circle cx="1034" cy={out.y + 14} r="2.5" fill="hsl(140 80% 70%)">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          <text x="105" y="425" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(280 60% 75%)" style={{ textTransform: "uppercase" }}>agents · clients</text>
          <text x="560" y="455" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(28 75% 70%)" style={{ textTransform: "uppercase" }}>verification quorum</text>
          <text x="965" y="425" textAnchor="middle" fontSize="9" fontFamily="JetBrains Mono, monospace" letterSpacing="2" fill="hsl(140 60% 70%)" style={{ textTransform: "uppercase" }}>on-chain · downstream</text>
        </svg>
      </div>

      {/* Mobile */}
      <div className="space-y-4 md:hidden">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(280_60%_75%)]">Agents · clients</div>
          <div className="grid grid-cols-3 gap-2">
            {["MCP", "REST API", "CLI"].map((l) => (
              <div key={l} className="rounded-lg border border-[hsl(280_50%_50%)]/30 bg-[hsl(280_30%_12%)]/40 p-2 text-center">
                <div className="text-[11px] font-semibold text-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mx-auto h-8 w-px bg-gradient-to-b from-primary/60 to-primary/20">
          <motion.span className="absolute left-[-3px] h-1.5 w-1.5 rounded-full bg-primary" animate={{ top: ["0%", "100%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
        </div>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">5-model quorum · parallel</div>
          <div className="grid grid-cols-2 gap-2">
            {["Claude", "GPT-4o", "Gemini", "Mistral", "Cerebras"].map((m, i) => (
              <motion.div key={m} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.1 }} className="rounded-lg border border-primary/30 bg-card/80 p-2 text-center">
                <div className="text-[11px] font-semibold text-foreground">{m}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="relative mx-auto h-8 w-px bg-gradient-to-b from-primary/40 to-[hsl(140_60%_55%)]/40">
          <motion.span className="absolute left-[-3px] h-1.5 w-1.5 rounded-full bg-[hsl(140_80%_70%)]" animate={{ top: ["0%", "100%"] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }} />
        </div>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(140_60%_70%)]">On-chain · downstream</div>
          <div className="space-y-2">
            {[
              { l: "RLUSD released", s: "XRPL EVM · 3-5s" },
              { l: "NFT cert minted", s: "XRPL Mainnet" },
              { l: "Webhook fired", s: "funds.released" },
            ].map((o) => (
              <div key={o.l} className="rounded-lg border border-[hsl(140_50%_45%)]/30 bg-[hsl(140_40%_10%)]/40 p-3">
                <div className="text-[12px] font-semibold text-foreground">{o.l}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{o.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
