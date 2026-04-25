"use client";

import React from "react";
import Link from "next/link";
import { ScrollReveal } from "@/components/scroll-reveal";
import { FAQ } from "@/components/faq";
import { FOOTER_LOGOS, type FooterLogoItem } from "@/components/brand-icons";
import { NodeBackground } from "@/components/node-background";
import { CinematicIntro } from "@/components/cinematic-intro";

/* ── Inline SVG icons ────────────────────────────────────────── */
function IconShield() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconScale() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M5 21h14" />
      <path d="M3 7l3 5-3 5" />
      <path d="M21 7l-3 5 3 5" />
      <line x1="3" y1="7" x2="21" y2="7" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}
function IconShieldSmall() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M3 9h6" />
      <path d="M3 15h6" />
      <path d="M13 9h5" />
      <path d="M13 15h5" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
      <line x1="2"  y1="20" x2="22" y2="20" />
    </svg>
  );
}
function IconFileCheck() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="9 15 11 17 15 13" />
    </svg>
  );
}
function IconTrending() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

/* ── Footer logo with hover colour ───────────────────────────── */
function FooterLogo({ logo }: { logo: FooterLogoItem }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      title={logo.name}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, cursor: "default", transition: "filter 0.2s ease" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {logo.renderIcon(hovered)}
    </div>
  );
}

/* ── Section divider ─────────────────────────────────────────── */
function GlowDivider() {
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        zIndex: 1,
        height: "1px",
        background: "radial-gradient(ellipse 50% 100% at 50%, rgba(196,112,75,0.22) 0%, transparent 100%)",
      }}
    />
  );
}

/* ── Mockup Cards ────────────────────────────────────────────── */
function EscrowMockup() {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 shadow-2xl" style={{ background: "#EDE6DD", color: "#171311" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "#52525b" }}>Escrow Status</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#C4704B" }} />
          <span className="text-xs font-medium" style={{ color: "#C4704B" }}>Active</span>
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: "#171311" }}>10,000 RLUSD</p>
        <p className="text-xs mt-1" style={{ color: "#78716c" }}>Locked until milestone completion</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs" style={{ color: "#78716c" }}>
          <span>Milestone 2 of 3</span>
          <span style={{ color: "#C4704B", fontWeight: 600 }}>65%</span>
        </div>
        <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: "65%", background: "linear-gradient(90deg,#C4704B,#D4B896)" }} />
        </div>
      </div>
    </div>
  );
}

function AIVerifyMockup() {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 shadow-2xl" style={{ background: "#EDE6DD", color: "#171311" }}>
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(0,0,0,0.05)" }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.12)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4704B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#171311" }}>milestone_proof.pdf</p>
          <p className="text-xs" style={{ color: "#78716c" }}>Uploaded 2 seconds ago</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse-dot shrink-0" style={{ background: "#C4704B" }} />
          <span className="text-xs" style={{ color: "#78716c" }}>AI verifying milestone criteria…</span>
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: "70%", background: "linear-gradient(90deg,#C4704B,#D4B896)" }} />
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "rgba(52,211,153,0.1)" }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(52,211,153,0.2)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: "#34d399" }}>Milestone criteria verified</span>
      </div>
    </div>
  );
}

function SettlementMockup() {
  return (
    <div className="rounded-2xl p-6 flex flex-col gap-4 shadow-2xl" style={{ background: "#EDE6DD", color: "#171311" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(52,211,153,0.12)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="font-bold" style={{ color: "#171311" }}>Transaction Complete</p>
      </div>
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: "#52525b" }}>Payment Released</p>
        <p className="text-4xl font-black" style={{ color: "#C4704B" }}>3.2s</p>
        <p className="text-xs mt-1" style={{ color: "#78716c" }}>Settlement time</p>
      </div>
      <div className="border-t pt-3 flex flex-col gap-2" style={{ borderColor: "rgba(0,0,0,0.07)" }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: "#78716c" }}>Amount</span>
          <span className="font-semibold">10,000 RLUSD</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "#78716c" }}>Network fee</span>
          <span className="font-semibold">0.000012 XRP</span>
        </div>
      </div>
    </div>
  );
}

/* ── Nav scroll script ───────────────────────────────────────── */
const scrollNavScript = `
(function(){
  var nav = document.getElementById('cs-nav');
  if(!nav) return;
  var introDone = false;
  window.addEventListener('scroll', function(){
    if(window.scrollY > 40){
      nav.style.background = 'rgba(23,19,17,0.92)';
      nav.style.backdropFilter = 'blur(20px)';
      nav.style.borderBottomColor = 'rgba(196,112,75,0.12)';
      if(!introDone) nav.querySelector('[data-nav-logo]').style.opacity = '1';
    } else {
      nav.style.background = 'transparent';
      nav.style.backdropFilter = 'none';
      nav.style.borderBottomColor = 'transparent';
      if(!introDone) nav.querySelector('[data-nav-logo]').style.opacity = '0';
    }
  });
  window.addEventListener('cascrow:intro-done', function(){
    introDone = true;
    nav.style.zIndex = '60';
    var logo = nav.querySelector('[data-nav-logo]');
    if(logo) logo.style.opacity = '1';
  });
})();
`;

/* ── Logo mark (nav inline) ──────────────────────────────────── */
function NavLogoMark() {
  return (
    <div
      data-nav-logo=""
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: 0,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <div style={{ width: 22, height: 3, borderRadius: 2, background: "#C4704B" }} />
        <div style={{ width: 22, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
        <div style={{ width: 22, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
      </div>
      <span
        style={{
          fontFamily: "var(--font-libre-franklin), sans-serif",
          fontWeight: 300,
          fontSize: 17,
          color: "#EDE6DD",
          letterSpacing: "4px",
        }}
      >
        cascrow
      </span>
    </div>
  );
}

/* ── CheckItem helper ────────────────────────────────────────── */
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm" style={{ color: "#A89B8C" }}>
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}
      >
        <IconCheck />
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Cascrow",
    "url": "https://cascrow.com",
    "description": "AI-powered escrow platform on the XRP Ledger. Locks RLUSD in native XRPL escrow and releases funds only when AI verifies milestone completion.",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free up to $1,000. 0–0.5% protocol fee per release."
    },
    "featureList": [
      "RLUSD escrow on XRP Ledger",
      "AI milestone verification",
      "Trustless settlement",
      "Multi-milestone contracts",
      "NFT completion certificates"
    ],
    "keywords": "xrpl escrow, rlusd escrow, ai escrow, milestone escrow, xls-85, crypto escrow"
  };

  return (
    <main className="flex flex-col min-h-screen overflow-x-hidden" style={{ background: "#171311", color: "#EDE6DD" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Global node background (fixed, z-0) ─────────── */}
      <NodeBackground />

      {/* ── Cinematic intro overlay (fixed, z-48–50) ────── */}
      <CinematicIntro />

      {/* ── Scroll-aware nav ────────────────────────────── */}
      <script dangerouslySetInnerHTML={{ __html: scrollNavScript }} />
      <nav
        id="cs-nav"
        className="fixed top-0 left-0 right-0 z-40 transition-[background-color,border-color] duration-300"
        style={{ background: "transparent", borderBottom: "1px solid transparent" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          {/* Logo — hidden behind cinematic overlay, fades in on scroll */}
          <Link href="/">
            <NavLogoMark />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#A89B8C" }}>
            <a href="#problem"    className="transition-colors hover:text-[#EDE6DD]">Why us</a>
            <a href="#how"        className="transition-colors hover:text-[#EDE6DD]">How it works</a>
            <a href="#features"   className="transition-colors hover:text-[#EDE6DD]">Features</a>
            <a href="#enterprise" className="transition-colors hover:text-[#EDE6DD]" style={{ color: "#C4704B" }}>Enterprise</a>
            <Link href="/guide"   className="transition-colors hover:text-[#EDE6DD]">Guide</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login"    className="hidden md:block text-sm transition-colors" style={{ color: "#A89B8C" }}>Login</Link>
            <Link href="/register" className="hidden md:block cs-btn-primary cs-btn-sm">Register</Link>
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden flex flex-col justify-center items-center gap-1.5 w-8 h-8"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              <span style={{ display: "block", width: 20, height: 2, borderRadius: 2, background: "#EDE6DD", transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
              <span style={{ display: "block", width: 20, height: 2, borderRadius: 2, background: "#EDE6DD", transition: "opacity 0.2s", opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: "block", width: 20, height: 2, borderRadius: 2, background: "#EDE6DD", transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div
            className="md:hidden border-t px-6 py-4 flex flex-col gap-1"
            style={{ background: "rgba(23,19,17,0.97)", borderColor: "rgba(196,112,75,0.12)" }}
          >
            {[
              { href: "#problem", label: "Why us" },
              { href: "#how",     label: "How it works" },
              { href: "#features",   label: "Features" },
              { href: "#enterprise",label: "Enterprise" },
              { href: "/guide",     label: "Guide" },
            ].map(({ href, label }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{ padding: "12px 4px", fontSize: 15, color: "#A89B8C", borderBottom: "1px solid rgba(196,112,75,0.07)", display: "block" }}
              >
                {label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              <Link href="/login"    onClick={() => setMenuOpen(false)} className="text-sm text-center py-2.5 rounded-xl" style={{ color: "#A89B8C", border: "1px solid rgba(196,112,75,0.2)" }}>Login</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="cs-btn-primary text-center">Register</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════
          HERO — full viewport, gives cinematic intro space
      ═══════════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 min-h-screen overflow-hidden">
        {/* Radial glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(196,112,75,0.06) 0%, transparent 70%)", zIndex: 1 }}
        />

        {/*
          Hero content — sits underneath the cinematic intro.
          It becomes the main focus after the overlay scrolls away.
        */}
        <div className="relative flex flex-col items-center gap-8 max-w-4xl pt-20 pb-12" style={{ zIndex: 1 }}>
          {/* Live badge */}
          <div
            className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-widest border"
            style={{ borderColor: "rgba(196,112,75,0.35)", color: "#C4704B", background: "rgba(196,112,75,0.07)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: "#C4704B" }} />
            Live · XRPL EVM Testnet · RLUSD
          </div>

          {/* H1 */}
          <h1
            className="animate-fade-up-1 leading-[1.05] tracking-tight"
            style={{
              fontFamily: "var(--font-libre-franklin), sans-serif",
              fontWeight: 300,
              fontSize: "clamp(44px, 8vw, 72px)",
              background: "linear-gradient(135deg, #D4B896 0%, #C4704B 30%, #F0D5CC 50%, #C4704B 70%, #D4B896 100%)",
              backgroundSize: "300%",
              animation: "shimmer-text 6s linear infinite",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Trust-free funding<br />on the XRP Ledger.
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-up-2 text-lg md:text-xl max-w-xl leading-relaxed" style={{ color: "#A89B8C" }}>
            Lock funds in RLUSD escrow. Upload your proof. AI verifies the milestone
            and releases payment — instantly.
          </p>

          {/* CTAs */}
          <div className="animate-fade-up-3 flex flex-col sm:flex-row gap-4">
            <Link href="/register" className="cs-btn-primary">Get Started</Link>
            <a href="#how"         className="cs-btn-ghost">Learn More</a>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ────────────────────────────────────── */}
      <div
        className="border-y py-5 overflow-hidden"
        style={{ background: "rgba(196,112,75,0.03)", borderColor: "rgba(196,112,75,0.1)", position: "relative", zIndex: 1 }}
      >
        <div className="flex animate-ticker whitespace-nowrap" style={{ width: "max-content" }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center gap-12 pr-12">
              {[
                { Icon: IconLayers,      label: "Built on XRPL EVM Sidechain" },
                { Icon: IconGlobe,       label: "Powered by RLUSD" },
                { Icon: IconMonitor,     label: "AI Verification by Claude, Gemini, OpenAI, Mistral & Qwen" },
                { Icon: IconShieldSmall, label: "Secured by MetaMask" },
                { Icon: IconLayers,      label: "Zero middlemen" },
                { Icon: IconGlobe,       label: "Instant settlement" },
                { Icon: IconMonitor,     label: "On-chain transparency" },
                { Icon: IconShieldSmall, label: "100% automated" },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-2.5 text-sm" style={{ color: "#A89B8C" }}>
                  <item.Icon />
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          PROBLEM
      ═══════════════════════════════════════════════════ */}
      <section id="problem" className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="mb-16">
            <h2
              className="text-4xl md:text-5xl mb-4 tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              The trust gap in funding
            </h2>
            <p style={{ color: "#A89B8C", fontSize: 18, fontWeight: 300 }}>
              Any time money is tied to a promised outcome, both sides are exposed.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {[
              { Icon: IconShield, title: "No payment security",          desc: "Whoever pays risks funding unmet promises. Whoever delivers risks completing work without getting paid. Every grant, subsidy, insurance payout, or corporate milestone runs on blind trust." },
              { Icon: IconClock,  title: "Escrow is slow and expensive",  desc: "Banks and lawyers add days of delay and thousands in fees to every deal." },
              { Icon: IconScale,  title: "Verification is subjective",    desc: "Milestone completion is judged manually with no neutral, automated decision-making." },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100} className="h-full">
                <div className="cs-card flex flex-col gap-5 h-full">
                  <item.Icon />
                  <div>
                    <h3 className="font-semibold text-lg mb-2" style={{ color: "#EDE6DD" }}>{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════════════ */}
      <section
        id="how"
        className="py-32 px-6"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-20">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "#C4704B", fontFamily: "var(--font-libre-franklin)" }}
            >
              How it works
            </p>
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Three steps to payout
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ alignItems: "stretch" }}>
            {[
              { num: "01", title: "Agree & lock",          desc: "Grant Giver and Receiver agree on a milestone and amount. Funds are locked in RLUSD escrow on the XRPL EVM Sidechain." },
              { num: "02", title: "Deliver & upload",       desc: "The Receiver completes the milestone and uploads proof as a PDF document." },
              { num: "03", title: "AI verifies & releases", desc: "Our AI evaluates the proof against the milestone criteria. If approved, funds are released instantly." },
            ].map((step, i) => (
              <ScrollReveal key={step.num} delay={i * 120} className="h-full">
                <div
                  className="flex flex-col gap-5 p-6 rounded-xl transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(196,112,75,0.1)",
                    height: "100%",
                  }}
                  onMouseOver={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(255,255,255,0.04)";
                    el.style.borderColor = "rgba(196,112,75,0.3)";
                    el.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(255,255,255,0.02)";
                    el.style.borderColor = "rgba(196,112,75,0.1)";
                    el.style.transform = "translateY(0)";
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-libre-franklin)",
                      fontWeight: 300,
                      fontSize: 64,
                      lineHeight: 1,
                      color: "#C4704B",
                      opacity: 0.85,
                    }}
                  >
                    {step.num}
                  </span>
                  <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C", flex: 1 }}>{step.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════════════ */}
      <section id="features" className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-20">
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Built for trust-free transactions
            </h2>
          </ScrollReveal>

          {/* Feature A */}
          <ScrollReveal className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>On-chain escrow with RLUSD</p>
              <h3 className="text-2xl font-semibold" style={{ color: "#EDE6DD" }}>Your funds, locked until it&apos;s earned</h3>
              <p className="text-base leading-relaxed" style={{ color: "#A89B8C" }}>
                Funds are locked in Ripple&apos;s USD-pegged stablecoin using smart contract escrow on the XRPL EVM Sidechain.
                No volatility, no middlemen, fully transparent on-chain.
              </p>
              <div className="flex flex-col gap-2.5">
                <CheckItem>Funds locked until milestone is proven</CheckItem>
                <CheckItem>AI decision in under 5 seconds</CheckItem>
                <CheckItem>Instant on-chain payout on approval</CheckItem>
              </div>
            </div>
            <EscrowMockup />
          </ScrollReveal>

          {/* Feature B */}
          <ScrollReveal className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 md:order-1"><AIVerifyMockup /></div>
            <div className="order-1 md:order-2 flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#D4956A" }}>AI-powered milestone verification</p>
              <h3 className="text-2xl font-semibold" style={{ color: "#EDE6DD" }}>No human gatekeepers</h3>
              <p className="text-base leading-relaxed" style={{ color: "#A89B8C" }}>
                Upload your proof as a PDF. Five independent AI models — Claude, Gemini, OpenAI, Mistral and Qwen — analyze it against the agreed milestone
                criteria and deliver an objective verdict in seconds.
              </p>
              <div className="flex flex-col gap-2.5">
                <CheckItem>Objective, bias-free evaluation</CheckItem>
                <CheckItem>Detailed reasoning for every decision</CheckItem>
                <CheckItem>Human review override for edge cases</CheckItem>
              </div>
            </div>
          </ScrollReveal>

          {/* Feature C */}
          <ScrollReveal className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Instant settlement</p>
              <h3 className="text-2xl font-semibold" style={{ color: "#EDE6DD" }}>Payment in seconds, not days</h3>
              <p className="text-base leading-relaxed" style={{ color: "#A89B8C" }}>
                Once AI approves a milestone, funds release to the Receiver&apos;s wallet via the XRP Ledger
                in 3-5 seconds. No wire transfers, no waiting.
              </p>
              <div className="flex flex-col gap-2.5">
                <CheckItem>3-5 second finality</CheckItem>
                <CheckItem>Near-zero network fees (&lt;$0.01)</CheckItem>
                <CheckItem>Full audit trail on-chain</CheckItem>
              </div>
            </div>
            <SettlementMockup />
          </ScrollReveal>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          WHY XRPL EVM SIDECHAIN
      ═══════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6"
        style={{ position: "relative", zIndex: 1 }}
      >
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Why we build on XRP Ledger
            </h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
            {[
              { stat: "EVM + XRP Ledger", statSize: 34, label: "Smart Contract · Dual Audit-Trail", desc: "Smart contract escrow on the XRPL EVM Sidechain, with every event written as an immutable audit memo on the native XRP Ledger." },
              { stat: "3-5 sec",          statSize: 48, label: "settlement",                        desc: "Transactions confirm in seconds, not minutes or hours." },
              { stat: "<$0.01",           statSize: 48, label: "per transaction",                   desc: "Near-zero fees make frequent settlements economically viable." },
              { stat: "100%",             statSize: 48, label: "transparent",                       desc: "All escrows are visible on-chain. Every action is dual-verified on both the EVM Sidechain and the XRP Ledger." },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 80} className="h-full">
                <div className="cs-card h-full" style={{ minHeight: "220px" }}>
                  <p
                    style={{
                      fontFamily: "var(--font-libre-franklin)",
                      fontWeight: 300,
                      fontSize: item.statSize,
                      color: "#C4704B",
                      lineHeight: 1.1,
                      marginBottom: 4,
                    }}
                  >
                    {item.stat}
                  </p>
                  <p className="font-semibold mb-2" style={{ color: "#EDE6DD" }}>{item.label}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          YOUR FUNDS, YOUR CONTROL
      ═══════════════════════════════════════════════════ */}
      <section className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Your funds, your control
            </h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-stretch">
            {[
              { Icon: IconLock,  title: "Self-custody",          desc: "Private keys never leave your wallet. You sign every transaction yourself via MetaMask." },
              { Icon: IconEye,   title: "On-chain transparency",  desc: "Every escrow is visible on the XRPL EVM Sidechain. Both parties can verify the status at any time." },
              { Icon: IconScale, title: "Automated fairness",     desc: "No human gatekeepers. AI decides based on the evidence, and the blockchain executes automatically." },
            ].map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 100} className="h-full">
                <div
                  className="flex flex-col items-center text-center gap-5 p-6 rounded-xl transition-colors"
                  style={{ background: "transparent", border: "1px solid transparent" }}
                  onMouseOver={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(196,112,75,0.04)";
                    el.style.borderColor = "rgba(196,112,75,0.15)";
                    el.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "transparent";
                    el.style.borderColor = "transparent";
                    el.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.2)" }}
                  >
                    <item.Icon />
                  </div>
                  <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>{item.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          ROADMAP
      ═══════════════════════════════════════════════════ */}
      <section className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-5xl mx-auto">
          <ScrollReveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#C4704B" }}>Roadmap</p>
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              What&apos;s coming next
            </h2>
            <p className="mt-4 text-lg" style={{ color: "#A89B8C" }}>
              Cascrow is live on testnet. Here&apos;s where we&apos;re taking it.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* KYC Tiers */}
            <ScrollReveal delay={0} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-5 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconShield />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Compliance</p>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Risk-based KYC</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  No unnecessary friction for small grants. Verification scales with the amount at stake.
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { tier: "Tier 0", label: "Email verified", limit: "up to $1K", note: "live now" },
                    { tier: "Tier 1", label: "Name + Sanctions screening", limit: "up to $10K", note: "live now" },
                    { tier: "Tier 2", label: "ID + Liveness check", limit: "up to $100K", note: "" },
                    { tier: "Tier 3", label: "KYB + Source of funds", limit: "unlimited", note: "" },
                  ].map((t) => (
                    <div key={t.tier} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-xs font-bold w-12 shrink-0" style={{ color: "#C4704B" }}>{t.tier}</span>
                      <span className="text-xs flex-1" style={{ color: "#A89B8C" }}>{t.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium" style={{ color: "#EDE6DD" }}>{t.limit}</span>
                        {t.note && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>{t.note}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Right column: two smaller cards */}
            <div className="flex flex-col gap-6 h-full">
              <ScrollReveal delay={100} className="flex-1">
                <div
                  className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                      <IconLayers />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Expert Review</p>
                      <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Human-in-the-loop</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                    For high-stakes decisions, AI generates a detailed report reviewed by a curated panel of domain experts. Double-blind, majority vote.
                  </p>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={200} className="flex-1">
                <div
                  className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                      <IconGlobe />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Settlement</p>
                      <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Choose your chain</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                    Before creating a contract, choose where the escrow settles — native XRPL Ledger via XLS-85 (Xumm / Crossmark) or the XRPL EVM Sidechain (MetaMask). Same trustless flow, your call.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Second row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 items-stretch">
            <ScrollReveal delay={0} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconMonitor />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Mainnet</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>NFTs live on XRPL Mainnet</span>
                    </div>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Real money, real stakes</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  Mainnet launch with fiat on-ramp — fund escrows directly by card or bank transfer. Payouts go straight to a bank account, no crypto wallet required.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconScale />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Disputes</p>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Structured resolution</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  A formal dispute workflow with escalation paths, arbitration timelines, and binding decisions — so every edge case has a clear, fair outcome.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconEye />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Verification</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>live now</span>
                    </div>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Active intelligence</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  AI that goes beyond uploaded documents — querying GitHub to analyze code, checking public APIs, and cross-referencing live data. Weighted confidence scores replace binary decisions as models improve.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Third row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-stretch">
            <ScrollReveal delay={0} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconTrending />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Intelligence</p>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>Milestone pricing benchmarks</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  Before committing to a deal, AI benchmarks the proposed amount and timeline against platform data — showing predicted completion rates for similar milestones so both sides set realistic expectations from the start.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100} className="h-full">
              <div
                className="rounded-2xl p-7 flex flex-col gap-4 h-full"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}>
                    <IconClipboard />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Learning</p>
                    <h3 className="font-semibold text-lg" style={{ color: "#EDE6DD" }}>AI post-mortem on every failure</h3>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                  When a milestone expires or is rejected, AI automatically generates a structured post-mortem for both parties — what went wrong, which signals were missed, and concrete steps to succeed next time.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          ENTERPRISE
      ═══════════════════════════════════════════════════ */}
      <section id="enterprise" className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        {/* Subtle radial glow behind the section */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(196,112,75,0.05) 0%, transparent 70%)" }}
        />

        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <ScrollReveal className="text-center mb-20">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest border mb-6"
              style={{ borderColor: "rgba(196,112,75,0.4)", color: "#C4704B", background: "rgba(196,112,75,0.07)" }}
            >
              Enterprise · Early Access
            </div>
            <h2
              className="text-4xl md:text-5xl tracking-tight mb-5"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Corporate goals.<br />AI-verified. Blockchain-secured.
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: "#A89B8C" }}>
              Set targets with your stakeholders. Submit evidence when they&apos;re met.
              AI verifies against real data. An immutable record lands on-chain — no auditor required.
            </p>
          </ScrollReveal>

          {/* Use-case cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16 items-stretch">
            {[
              {
                Icon: IconBarChart,
                label: "KPI Attestation",
                title: "10 % revenue increase Q1",
                desc: "Agree on targets with board or investors. Upload your quarterly report at deadline. AI cross-references the numbers and issues a tamper-proof certificate on-chain.",
              },
              {
                Icon: IconBuilding,
                label: "Group Compliance",
                title: "License usage across subsidiaries",
                desc: "Track SaaS spend, headcount limits, or regulatory quotas across every entity in your group. Each subsidiary submits, AI aggregates, headquarters sees a live dashboard.",
              },
              {
                Icon: IconFileCheck,
                label: "ESG & CSRD Reporting",
                title: "Verified sustainability targets",
                desc: "CSRD mandates auditable proof for ESG commitments from 2025. Replace expensive external auditors with continuous AI verification and an on-chain audit trail.",
              },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 100} className="h-full">
                <div
                  className="flex flex-col gap-5 p-7 rounded-2xl h-full"
                  style={{
                    background: "rgba(196,112,75,0.03)",
                    border: "1px solid rgba(196,112,75,0.18)",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  onMouseOver={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(196,112,75,0.07)";
                    el.style.borderColor = "rgba(196,112,75,0.35)";
                  }}
                  onMouseOut={(e) => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = "rgba(196,112,75,0.03)";
                    el.style.borderColor = "rgba(196,112,75,0.18)";
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.2)" }}
                  >
                    <item.Icon />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C4704B" }}>{item.label}</p>
                    <h3 className="font-semibold text-base mb-2" style={{ color: "#EDE6DD" }}>{item.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {/* How it integrates */}
          <ScrollReveal>
            <div
              className="rounded-2xl p-8 md:p-12"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.14)" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C4704B" }}>Zero-friction integration</p>
                    <h3 className="text-2xl font-semibold mb-3" style={{ color: "#EDE6DD" }}>No system changes. Just upload.</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
                      cascrow sits as a layer on top of your existing tools — SAP, Salesforce, Google Workspace, or a simple Excel export.
                      No API integration required, no IT project, no vendor lock-in.
                      The person running verification is your CFO or compliance lead, not your engineering team.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    {[
                      "Works with PDF, Excel, ERP exports and API feeds",
                      "AI describes what evidence it needs — you just provide it",
                      "On-chain record usable as regulatory audit evidence",
                      "Recurring schedules: monthly, quarterly or custom",
                    ].map((point) => (
                      <CheckItem key={point}>{point}</CheckItem>
                    ))}
                  </div>
                </div>

                {/* Mini flow diagram */}
                <div className="flex flex-col gap-3">
                  {[
                    { step: "01", title: "Define targets",   desc: "Both parties sign a structured commitment on-chain" },
                    { step: "02", title: "Collect evidence", desc: "Upload any file you already have — report, CSV, screenshot" },
                    { step: "03", title: "AI verifies",      desc: "Five models cross-check your evidence against the agreed criteria" },
                    { step: "04", title: "Record & report",  desc: "Immutable blockchain attestation + shareable PDF report" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(196,112,75,0.08)" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-libre-franklin)",
                          fontWeight: 300,
                          fontSize: 28,
                          lineHeight: 1,
                          color: "#C4704B",
                          opacity: 0.7,
                          minWidth: 36,
                        }}
                      >
                        {item.step}
                      </span>
                      <div>
                        <p className="font-semibold text-sm mb-0.5" style={{ color: "#EDE6DD" }}>{item.title}</p>
                        <p className="text-xs leading-relaxed" style={{ color: "#A89B8C" }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA row */}
              <div
                className="mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6"
                style={{ borderTop: "1px solid rgba(196,112,75,0.12)" }}
              >
                <div>
                  <p className="font-semibold mb-1" style={{ color: "#EDE6DD" }}>Interested in early access?</p>
                  <p className="text-sm" style={{ color: "#A89B8C" }}>
                    We&apos;re onboarding a small number of pilot companies. No commitment required.
                  </p>
                </div>
                <a
                  href="/enterprise"
                  className="cs-btn-primary whitespace-nowrap shrink-0"
                  style={{ minWidth: 180, textAlign: "center" }}
                >
                  Request early access
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════════ */}
      <section className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#C4704B" }}>FAQ</p>
            <h2
              className="text-4xl md:text-5xl tracking-tight"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 600, color: "#EDE6DD" }}
            >
              Common questions
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background:   "rgba(255,255,255,0.02)",
                border:       "1px solid rgba(196,112,75,0.12)",
                backdropFilter: "blur(8px)",
              }}
            >
              <FAQ />
            </div>
          </ScrollReveal>
        </div>
      </section>

      <GlowDivider />

      {/* ══════════════════════════════════════════════════
          CTA
      ═══════════════════════════════════════════════════ */}
      <section className="py-32 px-6" style={{ position: "relative", zIndex: 1 }}>

        <ScrollReveal className="max-w-3xl mx-auto text-center flex flex-col items-center gap-7">
          <h2
            className="leading-tight tracking-tight"
            style={{
              fontFamily: "var(--font-libre-franklin)",
              fontWeight: 600,
              fontSize: "clamp(36px, 6vw, 56px)",
              color: "#EDE6DD",
            }}
          >
            Start funding milestones today.
          </h2>
          <p className="text-lg" style={{ color: "#A89B8C" }}>
            Lock funds in escrow. Let AI handle the verification. Get paid instantly.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link href="/register" className="cs-btn-primary">Get Started</Link>
            <span className="text-sm" style={{ color: "#A89B8C" }}>Free to use on XRP Testnet</span>
          </div>
        </ScrollReveal>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════ */}
      <footer
        className="px-6 border-t"
        style={{ borderColor: "rgba(196,112,75,0.12)", position: "relative", zIndex: 1 }}
      >
        {/* Row 1 — branding + main nav */}
        <div className="max-w-6xl mx-auto flex items-center justify-between py-6 text-sm" style={{ color: "#A89B8C" }}>
          {/* Left — logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B" }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
            </div>
            <span
              style={{
                fontFamily: "var(--font-libre-franklin), sans-serif",
                fontWeight: 300,
                fontSize: 16,
                color: "#EDE6DD",
                letterSpacing: "4px",
              }}
            >
              cascrow
            </span>
          </div>

          {/* Center — powered by */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10, color: "#3D342C", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Powered by
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {FOOTER_LOGOS.map((logo) => (
                <FooterLogo key={logo.name} logo={logo} />
              ))}
            </div>
          </div>

          {/* Right — main nav */}
          <div className="flex gap-6">
            <Link href="/login"    className="transition-colors hover:text-[#EDE6DD]">Sign in</Link>
            <Link href="/register" className="transition-colors hover:text-[#EDE6DD]">Register</Link>
            <Link href="/stats"    className="transition-colors hover:text-[#EDE6DD]">Stats</Link>
          </div>
        </div>

        {/* Row 2 — legal bar */}
        <div
          className="max-w-6xl mx-auto flex items-center justify-between pb-5"
          style={{ borderTop: "1px solid rgba(196,112,75,0.06)", paddingTop: 14, fontSize: 11, color: "#3D342C" }}
        >
          <span>© 2026 Cascrow</span>
          <div className="flex gap-5">
            <Link href="/impressum"   className="transition-colors hover:text-[#A89B8C]">Impressum</Link>
            <Link href="/terms"       className="transition-colors hover:text-[#A89B8C]">Terms</Link>
            <Link href="/datenschutz" className="transition-colors hover:text-[#A89B8C]">Privacy</Link>
            <Link href="/risiken"     className="transition-colors hover:text-[#A89B8C]">Risk Disclosure</Link>
            <Link href="/widerruf"    className="transition-colors hover:text-[#A89B8C]">Withdrawal</Link>
            <Link href="/avv"         className="transition-colors hover:text-[#A89B8C]">DPA</Link>
            <Link href="/security"    className="transition-colors hover:text-[#A89B8C]">Security</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}
