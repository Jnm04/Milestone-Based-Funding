"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, Terminal, Lock, Upload, Sparkles, ShieldOff, Clock, Scale, Bot, Coins, Network, Cpu, Github } from "lucide-react";

/* ─── Reveal animation helper ─── */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateY(0) scale(1)"; obs.disconnect(); } },
      { threshold: 0.1, rootMargin: "-60px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: "translateY(28px) scale(0.98)", transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─── Section label ─── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="flex items-center gap-3">
        <span className="h-px w-8" style={{ background: "linear-gradient(90deg, hsl(22 55% 54%), transparent)" }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.22em", color: "hsl(22 55% 54%)" }}>{children}</span>
      </div>
    </Reveal>
  );
}

/* ─── Terminal header ─── */
function TerminalHeader({ path, command }: { path: string; command: string }) {
  return (
    <div className="mb-10 flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em" }}>
      <span style={{ color: "hsl(30 10% 62%)" }}>{path}</span>
      <span style={{ color: "hsl(22 55% 54%)" }}>›</span>
      <span style={{ color: "hsl(32 35% 92%)" }}>{command}</span>
      <span className="ml-1 inline-block h-3 w-1.5 animate-pulse" style={{ background: "hsl(22 55% 54%)" }} />
    </div>
  );
}

/* ─── Nav ─── */
function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="container-tight mt-4">
        <nav className="gradient-border flex items-center justify-between rounded-full px-5 py-2.5" style={{ background: "hsl(24 12% 6% / 0.6)", backdropFilter: "blur(20px)" }}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-copper font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <div className="hidden md:flex items-center gap-7">
            {[{ href: "#problem", label: "Problem" }, { href: "#how", label: "How it works" }, { href: "/security", label: "Security" }, { href: "/guide", label: "Guide" }].map(l => (
              <Link key={l.href} href={l.href} className="text-sm transition-colors hover:text-foreground" style={{ color: "hsl(30 10% 62%)" }}>{l.label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex text-sm px-3 py-1.5 transition-colors hover:text-foreground" style={{ color: "hsl(30 10% 62%)" }}>Login</Link>
            <Link href="/register" className="inline-flex items-center rounded-full bg-gradient-copper px-4 py-1.5 text-sm font-medium glow-on-hover" style={{ color: "hsl(24 14% 6%)" }}>Register</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

/* ─── Hero ─── */
function Hero() {
  return (
    <section className="relative overflow-hidden pt-36 pb-28 noise">
      <div className="absolute inset-0 -z-10 bg-aurora animate-aurora" aria-hidden />
      <div className="absolute inset-0 -z-10 opacity-50" aria-hidden style={{ backgroundImage: "linear-gradient(hsl(32 35% 92% / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(32 35% 92% / 0.04) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }} />
      <div className="absolute left-1/2 top-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl" style={{ background: "conic-gradient(from 90deg, hsl(22 70% 35% / 0.6), transparent 40%, hsl(28 80% 50% / 0.4) 70%, transparent)" }} />

      <div className="container-tight relative">
        <div className="mx-auto mb-10 flex w-fit items-center gap-3 rounded-full border px-4 py-1.5" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", backdropFilter: "blur(12px)" }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-dot rounded-full" style={{ background: "hsl(22 55% 54%)" }} />
            <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: "hsl(22 55% 54%)" }} />
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.2em", color: "hsl(30 10% 62%)" }}>v0.1 · Live · XRPL EVM · RLUSD</span>
        </div>

        <h1 className="mx-auto max-w-5xl text-center font-semibold leading-[1.02] tracking-[-0.03em]" style={{ fontSize: "clamp(48px, 8vw, 88px)" }}>
          <span className="block text-gradient">Escrow for the</span>
          <span className="block text-gradient-copper">agent economy.</span>
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-center text-lg" style={{ color: "hsl(30 10% 62%)" }}>
          Cascrow is an <span style={{ color: "hsl(32 35% 92%)" }}>agentic escrow platform</span>. AI agents submit milestone evidence and trigger a <span style={{ color: "hsl(32 35% 92%)" }}>5-model majority-vote</span> verification pipeline that autonomously releases RLUSD on the XRPL EVM Sidechain.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-gradient-copper px-7 py-3.5 text-sm font-medium glow-on-hover" style={{ color: "hsl(24 14% 6%)" }}>
            Start building <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a href="https://github.com/Jnm04/Milestone-Based-Funding" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 rounded-full border px-7 py-3.5 transition-colors hover:border-primary/60" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.4)", backdropFilter: "blur(12px)", color: "hsl(32 35% 92%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.18em" }}>
            <Terminal className="h-3.5 w-3.5" /> View source
          </a>
        </div>

        {/* Terminal mockup */}
        <div className="relative mx-auto mt-20 max-w-3xl">
          <div className="absolute -inset-4 rounded-3xl opacity-20 blur-2xl bg-gradient-copper" />
          <div className="gradient-border relative animate-float overflow-hidden rounded-2xl" style={{ background: "hsl(24 12% 6% / 0.8)", boxShadow: "0 30px 80px -30px hsl(22 60% 20% / 0.6)", backdropFilter: "blur(20px)" }}>
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 14% 4% / 0.4)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 70% 55% / 0.7)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(28 75% 70% / 0.7)" }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(22 55% 54% / 0.7)" }} />
              <span className="ml-3" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "hsl(30 10% 62%)" }}>agent@cascrow ~ submit-proof</span>
            </div>
            <div className="space-y-2 px-5 py-5" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.7 }}>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>$</span><span style={{ color: "hsl(32 35% 92%)" }}>cascrow milestone submit <span style={{ color: "hsl(22 55% 54%)" }}>--id M-0429 --proof ./report.pdf</span></span></div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>›</span><span style={{ color: "hsl(30 10% 62%)" }}>hashing proof · sha256 9f2e…c3a1</span></div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>›</span><span style={{ color: "hsl(30 10% 62%)" }}>dispatching to verification quorum…</span></div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-1 md:grid-cols-5">
                {[["claude","✓ approve"],["gemini","✓ approve"],["gpt-4o","✓ approve"],["mistral","✓ approve"],["qwen3","✗ reject"]].map(([model,verdict]) => (
                  <div key={model} className="flex items-center justify-between gap-2 border-l pl-3" style={{ borderColor: "hsl(28 18% 14%)" }}>
                    <span style={{ color: "hsl(30 10% 62%)" }}>{model}</span>
                    <span style={{ color: verdict.startsWith("✓") ? "hsl(22 55% 54%)" : "hsl(30 10% 62%)" }}>{verdict}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>›</span><span style={{ color: "hsl(30 10% 62%)" }}>quorum reached · 4/5</span></div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>›</span><span style={{ color: "hsl(22 55% 54%)" }}>FUNDS_RELEASED</span><span style={{ color: "hsl(30 10% 62%)" }}>25,000 RLUSD · tx 0x4a7c…b1e9</span></div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>›</span><span style={{ color: "hsl(28 75% 70%)" }}>NFT_MINTED</span><span style={{ color: "hsl(30 10% 62%)" }}>xrpl 000A…2F0E · non-transferable</span></div>
              <div className="flex gap-2"><span style={{ color: "hsl(22 55% 54%)" }}>$</span><span className="inline-block h-3 w-2 animate-pulse" style={{ background: "hsl(22 55% 54%)" }} /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Marquee ─── */
function Marquee() {
  const items = ["Built on XRPL EVM Sidechain","Powered by RLUSD","AI Verification · Claude · Gemini · OpenAI · Mistral · Qwen","Secured by MetaMask","Zero middlemen","Instant settlement","On-chain transparency","100% automated"];
  return (
    <section className="relative overflow-hidden border-y py-6" style={{ borderColor: "hsl(28 18% 14% / 0.6)", background: "hsl(24 14% 4% / 0.4)" }}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32" style={{ background: "linear-gradient(to right, hsl(24 14% 4%), transparent)" }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32" style={{ background: "linear-gradient(to left, hsl(24 14% 4%), transparent)" }} />
      <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
        {[...items,...items].map((item,i) => (
          <div key={i} className="flex items-center gap-12">
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textTransform: "uppercase" as const, letterSpacing: "0.2em", color: "hsl(30 10% 62%)" }}>{item}</span>
            <span className="h-1 w-1 rounded-full" style={{ background: "hsl(22 55% 54% / 0.6)" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Manifesto ─── */
function Manifesto() {
  return (
    <section className="relative py-32">
      <div className="container-tight">
        <TerminalHeader path="cascrow ~" command="cat manifesto.md" />
        <Reveal>
          <h2 className="max-w-4xl text-4xl font-semibold leading-[1.1] tracking-[-0.02em] md:text-6xl">
            <span className="text-gradient">Trust is the largest unmonetized expense in the global economy.</span>{" "}
            <span style={{ color: "hsl(30 10% 62%)" }}>Lawyers, banks, escrow agents, auditors, verifiers — every transaction tied to an outcome pays a tax to humans whose only job is to say </span>
            <span className="text-gradient-copper">"yes, it happened."</span>
          </h2>
        </Reveal>
        <Reveal delay={200}>
          <p className="mt-10 max-w-2xl text-lg" style={{ color: "hsl(30 10% 62%)" }}>
            We're replacing that tax with code. Programmable money + agentic verification turns every conditional payment into an API call. The first trillion-dollar financial primitive of the agent era.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Problem ─── */
function Problem() {
  const items = [
    { icon: ShieldOff, title: "No payment security", body: "Whoever pays risks funding unmet promises. Whoever delivers risks completing work without getting paid. Every grant, subsidy, or corporate milestone runs on blind trust." },
    { icon: Clock, title: "Escrow is slow and expensive", body: "Banks and lawyers add days of delay and thousands in fees to every deal." },
    { icon: Scale, title: "Verification is subjective", body: "Milestone completion is judged manually with no neutral, automated decision-making." },
  ];
  return (
    <section id="problem" className="relative py-32">
      <div className="container-tight">
        <div className="mb-14 flex flex-col gap-5">
          <SectionLabel>The problem</SectionLabel>
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <Reveal><h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-5xl">Conditional money is broken.</h2></Reveal>
            <Reveal delay={100}><p className="max-w-md" style={{ color: "hsl(30 10% 62%)" }}>Every dollar tied to an outcome runs through middlemen who slow it down, charge for it, and still get the call wrong.</p></Reveal>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 100}>
              <div className="gradient-border group relative overflow-hidden rounded-2xl p-7 glow-on-hover h-full" style={{ background: "hsl(24 12% 6% / 0.5)", backdropFilter: "blur(12px)" }}>
                <div className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.2)" }}>
                  <item.icon className="h-5 w-5" style={{ color: "hsl(22 55% 54%)" }} />
                </div>
                <h3 className="mb-3 text-lg font-semibold tracking-tight">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How It Works ─── */
function HowItWorks() {
  const steps = [
    { n: "01", icon: Lock, title: "Define & lock", body: "Two parties (or two agents) agree on milestone criteria. The hash is locked on-chain. Funds move into RLUSD escrow on the XRPL EVM Sidechain." },
    { n: "02", icon: Upload, title: "Submit proof", body: "A human uploads a document. Or an agent calls our API with structured evidence. SHA-256 of the artifact is locked on two chains." },
    { n: "03", icon: Sparkles, title: "Quorum verifies & releases", body: "5 models from 5 different AI labs vote. 3/5 majority releases funds instantly and mints a non-transferable XRPL completion NFT." },
  ];
  return (
    <section id="how" className="relative py-32">
      <div className="absolute inset-x-0 top-0 -z-10 h-px" style={{ background: "linear-gradient(to right, transparent, hsl(28 18% 14%), transparent)" }} />
      <div className="container-tight">
        <div className="mb-14 flex flex-col gap-5">
          <SectionLabel>How it works</SectionLabel>
          <Reveal><h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-5xl">Humans or agents — same three steps.</h2></Reveal>
          <Reveal delay={100}><p className="max-w-xl" style={{ color: "hsl(30 10% 62%)" }}>Built as an API from day one. Anything that can sign a transaction can use Cascrow.</p></Reveal>
        </div>
        <div className="relative grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="mb-6 flex items-center gap-4">
                <div className="relative grid h-24 w-24 place-items-center">
                  <div className="absolute inset-0 rounded-full opacity-20 blur-xl bg-gradient-copper" />
                  <div className="relative grid h-24 w-24 place-items-center rounded-full border font-semibold text-2xl text-gradient-copper" style={{ borderColor: "hsl(22 55% 54% / 0.3)", background: "hsl(24 12% 6%)", fontFamily: "'JetBrains Mono', monospace" }}>{s.n}</div>
                </div>
              </div>
              <div className="gradient-border rounded-2xl p-7" style={{ background: "hsl(24 12% 6% / 0.5)", backdropFilter: "blur(12px)" }}>
                <s.icon className="mb-4 h-6 w-6" style={{ color: "hsl(22 55% 54%)" }} />
                <h3 className="mb-2 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Why Now ─── */
function WhyNow() {
  const reasons = [
    { icon: Bot, title: "AI agents are entering the economy", body: "Anthropic, OpenAI, and Google are shipping agents that take real-world actions. They need a way to transact under conditions — not just call APIs." },
    { icon: Coins, title: "Stablecoins finally cleared regulatory haze", body: "RLUSD, USDC and the GENIUS-style frameworks unlock programmable USD on public ledgers. The settlement layer is no longer the blocker." },
    { icon: Network, title: "Multi-model AI eliminates single-vendor risk", body: "5 models from 5 different labs reaching majority consensus is finally cheap and fast enough to use as a verification primitive." },
    { icon: Cpu, title: "On-chain audit trails are now table-stakes", body: "EU CSRD, SEC climate rules, and grant program reporting all demand verifiable, non-repudiable proof of completion. We provide it by default." },
  ];
  return (
    <section className="relative py-32">
      <div className="container-tight">
        <TerminalHeader path="cascrow ~" command="why-now" />
        <Reveal><h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-5xl">Four shifts collide in 2026.</h2></Reveal>
        <Reveal delay={100}><p className="mt-5 max-w-2xl" style={{ color: "hsl(30 10% 62%)" }}>Every category-defining company is built on a window that just opened. Ours is open right now.</p></Reveal>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {reasons.map((r, i) => (
            <Reveal key={r.title} delay={i * 100}>
              <div className="gradient-border group relative overflow-hidden rounded-2xl p-7 glow-on-hover h-full" style={{ background: "hsl(24 12% 6% / 0.5)", backdropFilter: "blur(12px)" }}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.2)" }}>
                    <r.icon className="h-4 w-4" style={{ color: "hsl(22 55% 54%)" }} />
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "hsl(30 10% 62%)" }}>0{i + 1}</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold tracking-tight">{r.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>{r.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Market / TAM ─── */
function Market() {
  const markets = [
    { label: "Global escrow & trust services", value: "$420B", note: "incl. legal, banking, agency" },
    { label: "Outcome-based grants & subsidies", value: "$1.1T", note: "public + philanthropic, annual" },
    { label: "Performance-based contracts", value: "$2.4T", note: "B2B services, M&A earn-outs, milestones" },
    { label: "Programmable agent payments", value: "∞", note: "the new primitive — not yet measured" },
  ];
  return (
    <section className="relative py-32">
      <div className="container-tight">
        <TerminalHeader path="cascrow ~" command="market --tam" />
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:items-end">
          <Reveal><h2 className="text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-5xl">We're building toward a category that doesn't exist yet.</h2></Reveal>
          <Reveal delay={100}><p style={{ color: "hsl(30 10% 62%)" }}>Today's wedge is RLUSD-denominated milestone escrow. The endgame is the settlement layer for every agent-to-human and agent-to-agent payment that depends on verifiable outcomes.</p></Reveal>
        </div>
        <Reveal delay={150}>
          <div className="mt-14 overflow-hidden rounded-2xl border" style={{ borderColor: "hsl(28 18% 14%)" }}>
            <div className="grid md:grid-cols-4" style={{ gap: "1px", background: "hsl(28 18% 14%)" }}>
              {markets.map(m => (
                <div key={m.label} className="p-6" style={{ background: "hsl(24 12% 6% / 0.7)", backdropFilter: "blur(12px)" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.2em", color: "hsl(30 10% 62%)" }}>{m.label}</div>
                  <div className="mt-4 text-5xl font-semibold tracking-tight text-gradient-copper">{m.value}</div>
                  <div className="mt-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "hsl(30 10% 62%)" }}>{m.note}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-6 max-w-2xl" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "hsl(30 10% 62%)" }}>
            // Sources: World Bank, OECD, McKinsey Global Payments Report. TAM figures aggregated from public market reports — exact methodology in our deck.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Stack ─── */
function Stack() {
  const items = ["Next.js","TypeScript","Tailwind","XRPL EVM","RLUSD","MetaMask","XRP Ledger","NFTokenMint","Solidity","Anthropic Claude","Google Gemini","OpenAI GPT","Mistral","Cerebras Qwen","PostgreSQL","Prisma","Vercel","Upstash Redis","Resend","Sentry"];
  return (
    <section className="relative py-32">
      <div className="container-tight">
        <div className="mb-14 flex flex-col gap-5">
          <SectionLabel>Tech stack</SectionLabel>
          <Reveal><h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-gradient md:text-5xl">Production-grade infrastructure.</h2></Reveal>
          <Reveal delay={100}><p className="max-w-md" style={{ color: "hsl(30 10% 62%)" }}>The stack we run in production today — every layer hardened, monitored, and audited.</p></Reveal>
        </div>
        <Reveal delay={150}>
          <div className="flex flex-wrap gap-2">
            {items.map(s => (
              <span key={s} className="gradient-border rounded-full px-4 py-2 cursor-default transition-colors hover:text-foreground" style={{ background: "hsl(24 12% 6% / 0.5)", backdropFilter: "blur(12px)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "hsl(30 10% 62%)" }}>{s}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section className="relative py-32">
      <div className="container-tight">
        <Reveal>
          <div className="gradient-border relative overflow-hidden rounded-3xl px-8 py-20 text-center" style={{ background: "hsl(24 12% 6% / 0.4)", backdropFilter: "blur(12px)" }}>
            <div className="absolute inset-0 -z-10 bg-aurora opacity-60 animate-aurora" />
            <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl" style={{ background: "radial-gradient(circle, hsl(22 70% 45% / 0.5), transparent 70%)" }} />
            <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-6xl">Build on the trust layer for agents.</h2>
            <p className="mx-auto mt-6 max-w-xl" style={{ color: "hsl(30 10% 62%)" }}>Open API. Public chains. Multi-model verification. Start with one milestone — scale to your entire payment stack.</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-gradient-copper px-8 py-4 text-sm font-medium glow-on-hover" style={{ color: "hsl(24 14% 6%)" }}>
                Get Started — it's live <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/guide" className="inline-flex items-center gap-2 rounded-full border px-8 py-4 text-sm font-medium transition-colors hover:border-primary/60" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", color: "hsl(32 35% 92%)" }}>
                Read the guide
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="relative border-t py-14" style={{ borderColor: "hsl(28 18% 14%)" }}>
      <div className="container-tight">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-copper font-bold" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
              <span className="text-sm font-semibold tracking-tight">cascrow</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm" style={{ color: "hsl(30 10% 62%)" }}>Trust-free funding on the XRP Ledger. Lock RLUSD in escrow, prove your milestone, get paid instantly.</p>
            <div className="mt-5 flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "hsl(30 10% 62%)" }}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-pulse-dot rounded-full" style={{ background: "hsl(22 55% 54%)" }} />
                <span className="relative inline-block h-2 w-2 rounded-full" style={{ background: "hsl(22 55% 54%)" }} />
              </span>
              All systems operational
            </div>
          </div>
          <div>
            <div className="mb-4" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "hsl(30 10% 62%)" }}>Product</div>
            <ul className="space-y-2 text-sm">
              {[{ href: "/guide", label: "Guide" },{ href: "/security", label: "Security" },{ href: "/guide#agentic", label: "Agent Docs" },{ href: "/mcp-manifest.json", label: "MCP Manifest" }].map(l => (
                <li key={l.href}><Link href={l.href} className="transition-colors hover:text-foreground" style={{ color: "hsl(30 10% 62%)" }}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-4" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "hsl(30 10% 62%)" }}>Legal</div>
            <ul className="space-y-2 text-sm">
              {[{ href: "/datenschutz", label: "Datenschutz" },{ href: "/terms", label: "Terms" },{ href: "/impressum", label: "Impressum" }].map(l => (
                <li key={l.href}><Link href={l.href} className="transition-colors hover:text-foreground" style={{ color: "hsl(30 10% 62%)" }}>{l.label}</Link></li>
              ))}
              <li><a href="https://github.com/Jnm04/Milestone-Based-Funding" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground" style={{ color: "hsl(30 10% 62%)" }}><Github className="h-3.5 w-3.5" /> GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 text-xs md:flex-row md:items-center" style={{ borderColor: "hsl(28 18% 14%)", color: "hsl(30 10% 62%)", fontFamily: "'JetBrains Mono', monospace" }}>
          <span>© {new Date().getFullYear()} cascrow · all rights reserved</span>
          <span>XRPL EVM · Chain ID 1449000 · Built in EU 🇪🇺</span>
        </div>
        <p className="mt-6 text-xs" style={{ color: "hsl(30 10% 62%)" }}>
          We use strictly necessary session cookies to keep you logged in. No tracking, no advertising.{" "}
          <Link href="/terms" style={{ color: "hsl(22 55% 54%)" }}>Terms</Link> ·{" "}
          <Link href="/datenschutz" style={{ color: "hsl(22 55% 54%)" }}>Datenschutz</Link> ·{" "}
          <Link href="/impressum" style={{ color: "hsl(22 55% 54%)" }}>Impressum</Link>
        </p>
      </div>
    </footer>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Manifesto />
        <Problem />
        <HowItWorks />
        <WhyNow />
        <Market />
        <Stack />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
