import Link from "next/link";
import { HeroCanvas } from "@/components/hero-canvas";
import { ContractDemo } from "@/components/contract-demo";
import { ScrollReveal } from "@/components/scroll-reveal";
import { FAQ } from "@/components/faq";
import { TECH_LOGOS } from "@/components/brand-icons";

/* ── tiny SVG icons (outline, terracotta) ───────────────────── */
function IconLock() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M5 21h14" />
      <path d="M3 7l3 5-3 5" />
      <path d="M21 7l-3 5 3 5" />
      <line x1="3" y1="7" x2="21" y2="7" />
    </svg>
  );
}
function IconShieldCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconQuestion() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C1654A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

/* ── left-border card style helper ─────────────────────────── */
const cardStyle = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderLeft: "1px solid rgba(193,101,74,0.45)",
  boxShadow: "-1px 0 12px rgba(193,101,74,0.1)",
};

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen overflow-x-hidden" style={{ background: "#0C0A09", color: "#F0EDE8" }}>

      {/* ── Nav ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{ background: "rgba(12,10,9,0.85)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-xl tracking-tight text-white">
            Cas<span style={{ color: "#C1654A" }}>crow</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#9CA3AF" }}>
            <a href="#problem" className="hover:text-white transition-colors">Why us</a>
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm px-4 py-2 rounded-full transition-all hover:text-white" style={{ color: "#9CA3AF" }}>
              Sign in
            </Link>
            <Link
              href="/register"
              className="text-sm px-5 py-2 rounded-full font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "#C1654A", boxShadow: "0 0 20px rgba(193,101,74,0.3)" }}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-44 pb-36 min-h-screen overflow-hidden">
        <HeroCanvas />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(193,101,74,0.1) 0%, transparent 70%)" }} />

        <div className="relative z-10 flex flex-col items-center gap-7 max-w-4xl">
          <div
            className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border"
            style={{ borderColor: "rgba(193,101,74,0.4)", color: "#C1654A", background: "rgba(193,101,74,0.08)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: "#C1654A" }} />
            Live · XRPL EVM Testnet · RLUSD
          </div>

          <h1 className="animate-fade-up-1 text-6xl sm:text-7xl md:text-8xl font-black tracking-tighter leading-[0.95] text-white">
            Funding that<br />
            <span
              style={{
                background: "linear-gradient(135deg, #C1654A 0%, #E8956A 50%, #C1654A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              delivers.
            </span>
          </h1>

          <p className="animate-fade-up-2 text-lg md:text-xl max-w-2xl leading-relaxed" style={{ color: "#9CA3AF" }}>
            RLUSD locked in escrow — released only when Claude + Gemini AI confirm your milestone is complete.
            No middlemen. No disputes. Instant settlement.
          </p>

          <div className="animate-fade-up-3 flex flex-col sm:flex-row gap-4 mt-2">
            <Link
              href="/register"
              className="group px-8 py-4 rounded-full text-white font-semibold text-base transition-all hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg, #C1654A, #9B4A32)", boxShadow: "0 8px 40px rgba(193,101,74,0.4)" }}
            >
              Get started for free
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-full font-semibold text-base border transition-all hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.12)", color: "#D1D5DB" }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Announcement ticker ── */}
      <div className="overflow-hidden border-y py-3" style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0A0807" }}>
        <div className="flex animate-ticker whitespace-nowrap" style={{ width: "max-content" }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center gap-10 pr-10">
              {[
                { icon: "⬡", label: "Built on XRP Ledger" },
                { icon: "+", label: "Powered by RLUSD" },
                { icon: "⊡", label: "AI Verification by Claude" },
                { icon: "⊟", label: "Secured by Xumm" },
                { icon: "⬡", label: "Zero middlemen" },
                { icon: "+", label: "Instant settlement" },
                { icon: "⊡", label: "On-chain transparency" },
                { icon: "⊟", label: "100% automated" },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2.5 text-sm font-medium" style={{ color: "#6B7280" }}>
                  <span className="text-xs" style={{ color: "#C1654A" }}>{item.icon}</span>
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── The trust gap (Problem) ── */}
      <section id="problem" className="py-28 px-6" style={{ background: "#0C0A09" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
              The trust gap in startup funding
            </h2>
            <p style={{ color: "#6B7280" }}>Traditional funding processes are broken.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                Icon: IconShieldCheck,
                title: "No payment security",
                desc: "Grant Givers risk funding unfinished projects. Receivers risk delivering without getting paid.",
              },
              {
                Icon: IconClock,
                title: "Escrow is slow and expensive",
                desc: "Banks and lawyers add days of delay and thousands in fees to every deal.",
              },
              {
                Icon: IconQuestion,
                title: "Verification is subjective",
                desc: "Milestone completion is judged manually with no neutral, automated decision-making.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100}>
                <div className="p-7 rounded-xl flex flex-col gap-5" style={cardStyle}>
                  <item.Icon />
                  <div>
                    <h3 className="font-bold text-lg text-white mb-2">{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-28 px-6" style={{ background: "#0F0C0B" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C1654A" }}>How it works</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Three steps to payout</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { num: "01", title: "Agree & lock", desc: "Grant Giver and receiver agree on a milestone and amount. Funds are locked in RLUSD escrow on the XRP Ledger." },
              { num: "02", title: "Deliver & upload", desc: "The receiver completes the milestone and uploads proof as a PDF document." },
              { num: "03", title: "AI verifies & releases", desc: "Our AI evaluates the proof against the milestone criteria. If approved, funds are released instantly." },
            ].map((step, i) => (
              <ScrollReveal key={step.num} delay={i * 120}>
                <div className="flex flex-col gap-0">
                  {/* Number + connector */}
                  <div className="flex items-center gap-0 mb-6">
                    <span className="text-5xl font-black leading-none" style={{ color: "#C1654A" }}>{step.num}</span>
                    {i < 2 && (
                      <div className="flex-1 flex items-center ml-4">
                        <div className="h-px flex-1" style={{ background: "linear-gradient(90deg, rgba(193,101,74,0.5), rgba(193,101,74,0.1))" }} />
                        <div className="w-2 h-2 rounded-full shrink-0 mx-1" style={{ background: "rgba(193,101,74,0.4)" }} />
                        <div className="h-px flex-1" style={{ background: "rgba(193,101,74,0.1)" }} />
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-white mb-2">{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Built for trust-free transactions (Live Demo) ── */}
      <section className="py-24 px-6" style={{ background: "#0C0A09" }}>
        <ScrollReveal className="max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight text-center mb-14">
            Built for trust-free transactions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#C1654A" }}>On-chain escrow with RLUSD</p>
              <p className="text-lg leading-relaxed" style={{ color: "#6B7280" }}>
                Funds are locked in Ripple&apos;s USD-pegged stablecoin using native XRP Ledger escrow. No
                volatility, no middlemen, fully transparent on-chain.
              </p>
              <div className="flex flex-col gap-3">
                {[
                  "Funds locked until milestone is proven",
                  "AI decision in under 5 seconds",
                  "Instant on-chain payout on approval",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#C1654A" }} />
                    <span className="text-sm" style={{ color: "#9CA3AF" }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <ContractDemo />
          </div>
        </ScrollReveal>
      </section>

      {/* ── Why we build on XRP Ledger ── */}
      <section className="py-28 px-6" style={{ background: "#0F0C0B" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Why we build on the XRP Ledger</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                stat: "Native",
                label: "escrow",
                desc: "No smart contracts needed — escrow is built into the protocol with XLS-85 support for RLUSD",
              },
              {
                stat: "3-5 sec",
                label: "settlement",
                desc: "Transactions confirm in seconds, not minutes or hours",
              },
              {
                stat: "<$0.01",
                label: "per transaction",
                desc: "Near-zero fees make frequent settlements economically viable",
              },
              {
                stat: "100%",
                label: "transparent",
                desc: "All escrows are visible and verifiable on-chain by both parties",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 80}>
                <div className="p-8 rounded-xl" style={cardStyle}>
                  <p className="text-4xl font-black mb-1" style={{ color: "#C1654A" }}>{item.stat}</p>
                  <p className="font-bold text-white mb-3">{item.label}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Your funds, your control ── */}
      <section id="features" className="py-28 px-6" style={{ background: "#0C0A09" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Your funds, your control</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                Icon: IconLock,
                title: "Self-custody",
                desc: "Private keys never leave your wallet. You sign every transaction yourself via Xumm.",
              },
              {
                Icon: IconEye,
                title: "On-chain transparency",
                desc: "Every escrow is visible on the XRP Ledger. Both parties can verify the status at any time.",
              },
              {
                Icon: IconScale,
                title: "Automated fairness",
                desc: "No human gatekeepers. AI decides based on the evidence, and the blockchain executes automatically.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100}>
                <div className="flex flex-col items-center text-center gap-4 py-4">
                  <item.Icon />
                  <h3 className="font-bold text-lg text-white">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="py-12 px-6 border-y" style={{ borderColor: "rgba(255,255,255,0.05)", background: "#0F0C0B" }}>
        <ScrollReveal className="max-w-4xl mx-auto flex flex-col items-center gap-6">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#4B5563" }}>Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {TECH_LOGOS.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all hover:border-white/20"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                  style={{ background: t.bgColor }}
                >
                  {t.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: "#9CA3AF" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 px-6" style={{ background: "#0C0A09" }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C1654A" }}>Testimonials</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">What people are saying</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote: "Cascrow completely changed how we structure startup deals. The AI verification removed all the subjective back-and-forth we used to have.",
                name: "Sarah Chen",
                title: "Managing Partner, Nexus Ventures",
                initials: "SC",
                color: "#C1654A",
              },
              {
                quote: "We hit our milestone, uploaded the report, and the funds were in our wallet within seconds. No emails, no waiting, no negotiation. Just code doing what it should.",
                name: "Marcus Weber",
                title: "Co-Founder, Buildstack",
                initials: "MW",
                color: "#3B82F6",
              },
              {
                quote: "As a grant giver, I finally feel confident that my funds only move when real progress is made. The transparency on-chain is something traditional escrow can't offer.",
                name: "Priya Nair",
                title: "Angel Grant Giver",
                initials: "PN",
                color: "#10B981",
              },
            ].map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 100}>
                <div className="group relative flex flex-col gap-5 p-7 rounded-2xl" style={cardStyle}>
                  <div className="text-3xl mb-1" style={{ color: "#C1654A" }}>&ldquo;</div>
                  <p className="text-sm leading-relaxed" style={{ color: "#D1D5DB" }}>{t.quote}</p>
                  <div className="flex items-center gap-3 mt-auto pt-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ background: t.color }}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>{t.title}</p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6" style={{ background: "#0F0C0B" }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#C1654A" }}>FAQ</p>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Common questions</h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="rounded-2xl border px-8" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}>
              <FAQ />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-28 px-6" style={{ background: "#0C0A09" }}>
        <ScrollReveal className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
          <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-tight">
            Start funding milestones today.
          </h2>
          <p className="text-lg" style={{ color: "#6B7280" }}>
            Lock funds in escrow. Let AI handle the verification. Get paid instantly.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/register"
              className="px-10 py-4 rounded-full font-bold text-base transition-all hover:scale-[1.03]"
              style={{ background: "#F0EDE8", color: "#0C0A09" }}
            >
              Get Started
            </Link>
            <span className="text-sm" style={{ color: "#4B5563" }}>Free to use on XRP Testnet</span>
          </div>
        </ScrollReveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8 px-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: "#6B7280" }}>
          <span className="font-bold text-white">
            Cas<span style={{ color: "#C1654A" }}>crow</span>
          </span>
          <span>© 2025 Cascrow · Built on XRPL EVM · RLUSD · Claude + Gemini AI</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
