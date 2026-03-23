"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import NetworkBackground from "@/components/shared/NetworkBackground";

// ─── SVG Icon Components ──────────────────────────────────────────────────────
const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
  </svg>
);
const ScaleIconSm = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M3 9l9-6 9 6M4 15h4m8 0h4M5 19h14"/>
  </svg>
);
const LockIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const EyeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const BalanceIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M2 8l10-6 10 6M4 17h4m8 0h4M3 20h18"/>
  </svg>
);
const LayersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const CirclePlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const BotIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 2v6M8 8V6M16 8V6"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><path d="M9 18h6"/>
  </svg>
);
const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
);
const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A89B8C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B8A5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B8A5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ─── CSS Styles ───────────────────────────────────────────────────────────────
const CSS_STYLES = `
  @media (prefers-reduced-motion: no-preference) {
    @keyframes gradientShift {
      0%   { background-position: 0% 50%; }
      100% { background-position: 200% 50%; }
    }
    @keyframes heroFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-8px); }
    }
    @keyframes bounceChevron {
      0%, 100% { transform: translateX(-50%) translateY(0px); }
      50%       { transform: translateX(-50%) translateY(6px); }
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }

    .hero-headline {
      animation:
        gradientShift 7s linear infinite,
        heroFadeIn 0.5s 0.1s ease-out both;
    }
    .hero-subtitle  { animation: heroFadeIn 0.5s 0.3s ease-out both; }
    .hero-buttons   { animation: heroFadeIn 0.5s 0.5s ease-out both; }
    .scroll-chevron { animation: bounceChevron 2s ease-in-out infinite; }
    .mockup-float   { animation: float 4s ease-in-out infinite; }
    .spinner        { animation: spin 1.2s linear infinite; }
  }

  /* Gradient headline base (always applied) */
  .hero-headline {
    background: linear-gradient(90deg, #C4704B, #D4B896, #EDE6DD, #D4B896, #C4704B);
    background-size: 300% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: #EDE6DD;
    font-size: clamp(2.4rem, 6.5vw, 4.75rem);
  }

  /* Scroll reveal */
  .scroll-animate {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .scroll-animate.is-visible  { opacity: 1; transform: translateY(0); }
  .scroll-animate.delay-1     { transition-delay: 0.15s; }
  .scroll-animate.delay-2     { transition-delay: 0.30s; }
  .scroll-animate.delay-3     { transition-delay: 0.45s; }

  /* Buttons */
  .btn-primary {
    background: #EDE6DD;
    color: #171311;
    border: none;
    border-radius: 999px;
    padding: 0.875rem 2.25rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    display: inline-block;
  }
  .btn-primary:hover  { transform: scale(1.02); box-shadow: 0 0 28px rgba(196,112,75,0.45); }
  .btn-primary:active { transform: scale(0.98); }

  .btn-secondary {
    background: transparent;
    color: #EDE6DD;
    border: 1px solid rgba(196,112,75,0.3);
    border-radius: 999px;
    padding: 0.875rem 2.25rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s ease;
  }
  .btn-secondary:hover { border-color: #C4704B; }

  /* Nav & footer links */
  .nav-link    { transition: color 0.2s ease; }
  .nav-link:hover { color: #C4704B !important; }
  .footer-link { transition: color 0.2s ease; }
  .footer-link:hover { color: #C4704B !important; }

  /* Cards hover */
  .problem-card:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(196,112,75,0.09); }
  .xrp-card:hover     { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(196,112,75,0.09); }

  /* Spinner */
  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid rgba(196,112,75,0.2);
    border-top-color: #C4704B;
    border-radius: 50%;
    display: inline-block;
  }

  /* Responsive feature rows */
  @media (max-width: 768px) {
    .feature-row { grid-template-columns: 1fr !important; }
    .feature-row-rev > :first-child { order: 1; }
    .feature-row-rev > :last-child  { order: 2; }
  }
`;

// ─── Scroll animation hook ────────────────────────────────────────────────────
function useScrollAnimate() {
  useEffect(() => {
    const els = document.querySelectorAll(".scroll-animate");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("is-visible"); }),
      { threshold: 0.1 }
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage() {
  const { data: session } = useSession();
  const loggedIn = !!session;
  useScrollAnimate();

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <style>{CSS_STYLES}</style>
      <div style={{ background:"#171311", color:"#EDE6DD", position:"relative", overflowX:"hidden" }}>
        <NetworkBackground density="high" interactive={true} />

        <div style={{ position:"relative", zIndex:1 }}>

          {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
          <nav style={{
            position:"sticky", top:0, zIndex:50,
            background:"rgba(23,19,17,0.82)",
            backdropFilter:"blur(12px)",
            WebkitBackdropFilter:"blur(12px)",
            borderBottom:"1px solid rgba(196,112,75,0.10)",
            padding:"0 2rem",
            height:"60px",
            display:"flex",
            alignItems:"center",
            justifyContent:"space-between",
          }}>
            <span style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.05rem", letterSpacing:"-0.01em" }}>
              Milestone Funding
            </span>
            <div style={{ display:"flex", gap:"1.5rem", alignItems:"center" }}>
              {loggedIn ? (
                <Link href="/dashboard" style={{ color:"#A89B8C", textDecoration:"none", fontSize:"0.9rem" }} className="nav-link">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login"    style={{ color:"#A89B8C", textDecoration:"none", fontSize:"0.9rem" }} className="nav-link">Login</Link>
                  <Link href="/register" style={{ color:"#A89B8C", textDecoration:"none", fontSize:"0.9rem" }} className="nav-link">Register</Link>
                </>
              )}
            </div>
          </nav>

          {/* ── HERO ───────────────────────────────────────────────────────── */}
          <section style={{
            minHeight:"100vh",
            display:"flex",
            flexDirection:"column",
            alignItems:"center",
            justifyContent:"center",
            padding:"4rem 1.5rem 6rem",
            textAlign:"center",
            position:"relative",
          }}>
            {/* Radial glow */}
            <div style={{
              position:"absolute", top:"50%", left:"50%",
              transform:"translate(-50%,-50%)",
              width:"700px", height:"500px",
              background:"radial-gradient(ellipse, rgba(196,112,75,0.11) 0%, transparent 70%)",
              pointerEvents:"none",
            }} />

            <h1 className="hero-headline" style={{
              fontWeight:800,
              letterSpacing:"-0.03em",
              lineHeight:1.1,
              maxWidth:"950px",
              margin:"0 0 1.5rem",
            }}>
              Trust-free funding on the<br />XRP Ledger.
            </h1>

            <p className="hero-subtitle" style={{
              color:"#A89B8C",
              fontSize:"1.1rem",
              maxWidth:"560px",
              margin:"0 0 2.75rem",
              lineHeight:1.65,
              opacity:0,
            }}>
              Lock funds in RLUSD escrow. Upload your proof. AI verifies the milestone and releases payment — instantly.
            </p>

            <div className="hero-buttons" style={{
              display:"flex",
              gap:"1rem",
              flexWrap:"wrap",
              justifyContent:"center",
              opacity:0,
            }}>
              <Link href={loggedIn ? "/dashboard" : "/register"}>
                <button className="btn-primary">Get Started</button>
              </Link>
              <button className="btn-secondary" onClick={() => scrollTo("how-it-works")}>
                Learn More
              </button>
            </div>

            {/* Scroll chevron */}
            <div className="scroll-chevron" style={{ position:"absolute", bottom:"2.5rem", left:"50%" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A89B8C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </section>

          {/* ── TRUST BAR ──────────────────────────────────────────────────── */}
          <section style={{
            background:"#1E1814",
            borderTop:"1px solid rgba(196,112,75,0.08)",
            borderBottom:"1px solid rgba(196,112,75,0.08)",
            padding:"1.25rem 2rem",
          }}>
            <div style={{
              maxWidth:"960px", margin:"0 auto",
              display:"flex", gap:"1.5rem",
              justifyContent:"space-around",
              flexWrap:"wrap",
            }}>
              {[
                { icon:<LayersIcon />, label:"Built on XRP Ledger" },
                { icon:<CirclePlusIcon />, label:"Powered by RLUSD" },
                { icon:<BotIcon />, label:"AI Verification by Claude" },
                { icon:<PhoneIcon />, label:"Secured by Xumm" },
              ].map(({ icon, label }) => (
                <div key={label} style={{
                  display:"flex", alignItems:"center", gap:"0.5rem",
                  color:"#A89B8C", fontSize:"0.85rem",
                }}>
                  {icon}
                  {label}
                </div>
              ))}
            </div>
          </section>

          {/* ── THE PROBLEM ────────────────────────────────────────────────── */}
          <section id="problem" style={{ padding:"6rem 2rem", maxWidth:"1100px", margin:"0 auto" }}>
            <div className="scroll-animate" style={{ textAlign:"center", marginBottom:"3rem" }}>
              <h2 style={{ fontWeight:700, fontSize:"clamp(1.8rem, 4vw, 2.6rem)", color:"#EDE6DD", margin:"0 0 0.75rem", letterSpacing:"-0.02em" }}>
                The trust gap in startup funding
              </h2>
              <p style={{ color:"#A89B8C", fontSize:"1.05rem", margin:0 }}>Traditional funding processes are broken.</p>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:"1.5rem" }}>
              {[
                { icon:<ShieldIcon />, title:"No payment security", desc:"Investors risk funding unfinished projects. Startups risk delivering without getting paid.", delay:"" },
                { icon:<ClockIcon />,  title:"Escrow is slow and expensive", desc:"Banks and lawyers add days of delay and thousands in fees to every deal.", delay:"delay-1" },
                { icon:<ScaleIconSm />, title:"Verification is subjective", desc:"Milestone completion is judged manually with no neutral, automated decision-making.", delay:"delay-2" },
              ].map(({ icon, title, desc, delay }) => (
                <div key={title} className={`scroll-animate ${delay} problem-card`} style={{
                  background:"#221C18",
                  borderRadius:"16px",
                  padding:"1.75rem",
                  border:"1px solid rgba(196,112,75,0.10)",
                  borderTop:"3px solid #C4704B",
                  transition:"transform 0.2s ease, box-shadow 0.2s ease",
                }}>
                  <div style={{ color:"#C4704B", marginBottom:"1rem" }}>{icon}</div>
                  <h3 style={{ fontWeight:700, color:"#EDE6DD", margin:"0 0 0.5rem", fontSize:"1.05rem" }}>{title}</h3>
                  <p style={{ color:"#A89B8C", fontSize:"0.9rem", lineHeight:1.65, margin:0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
          <section id="how-it-works" style={{ padding:"6rem 2rem", maxWidth:"1100px", margin:"0 auto" }}>
            <h2 className="scroll-animate" style={{
              fontWeight:700,
              fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
              color:"#EDE6DD",
              textAlign:"center",
              marginBottom:"4rem",
              letterSpacing:"-0.02em",
            }}>
              From agreement to payout in three steps
            </h2>

            <div style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",
              gap:"2.5rem",
              position:"relative",
            }}>
              {[
                { num:"01", title:"Agree & lock", desc:"Investor and startup agree on a milestone and amount. Funds are locked in RLUSD escrow on the XRP Ledger.", delay:"" },
                { num:"02", title:"Deliver & upload", desc:"The startup completes the milestone and uploads proof as a PDF document.", delay:"delay-1" },
                { num:"03", title:"AI verifies & releases", desc:"Our AI evaluates the proof against the milestone criteria. If approved, funds are released instantly.", delay:"delay-2" },
              ].map(({ num, title, desc, delay }) => (
                <div key={num} className={`scroll-animate ${delay}`}>
                  <div style={{ fontSize:"3.5rem", fontWeight:800, color:"#C4704B", lineHeight:1, marginBottom:"0.75rem" }}>{num}</div>
                  <h3 style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.15rem", margin:"0 0 0.5rem" }}>{title}</h3>
                  <p style={{ color:"#A89B8C", fontSize:"0.9rem", lineHeight:1.65, margin:0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── KEY FEATURES ───────────────────────────────────────────────── */}
          <section style={{ padding:"6rem 2rem", maxWidth:"1100px", margin:"0 auto" }}>
            <h2 className="scroll-animate" style={{
              fontWeight:700,
              fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
              color:"#EDE6DD",
              textAlign:"center",
              marginBottom:"5rem",
              letterSpacing:"-0.02em",
            }}>
              Built for trust-free transactions
            </h2>

            {/* Feature 1: text left, visual right */}
            <div className="scroll-animate feature-row" style={{
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              gap:"4rem",
              alignItems:"center",
              marginBottom:"6rem",
            }}>
              <div>
                <h3 style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.45rem", margin:"0 0 1rem" }}>On-chain escrow with RLUSD</h3>
                <p style={{ color:"#A89B8C", lineHeight:1.75, margin:0 }}>
                  Funds are locked in Ripple&apos;s USD-pegged stablecoin using native XRP Ledger escrow. No volatility, no middlemen, fully transparent on-chain.
                </p>
              </div>
              <div className="mockup-float" style={{
                background:"#221C18",
                borderRadius:"16px",
                padding:"1.75rem",
                border:"1px solid rgba(196,112,75,0.12)",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                  <span style={{ color:"#A89B8C", fontSize:"0.85rem" }}>Escrow Status</span>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#C4704B" }} />
                </div>
                <div style={{ marginBottom:"0.75rem" }}>
                  <span style={{ fontSize:"2.1rem", fontWeight:700, color:"#EDE6DD" }}>10,000 </span>
                  <span style={{ fontWeight:600, color:"#C4704B" }}>RLUSD</span>
                </div>
                <p style={{ color:"#A89B8C", fontSize:"0.8rem", margin:"0 0 1rem" }}>Locked until milestone completion</p>
                <div style={{ background:"#2A2320", borderRadius:"999px", height:"6px", marginBottom:"0.5rem", overflow:"hidden" }}>
                  <div style={{ background:"#C4704B", height:"100%", width:"65%", borderRadius:"999px" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:"#A89B8C", fontSize:"0.75rem" }}>Milestone 2 of 3</span>
                  <span style={{ color:"#A89B8C", fontSize:"0.75rem" }}>65%</span>
                </div>
              </div>
            </div>

            {/* Feature 2: visual left, text right */}
            <div className="scroll-animate feature-row feature-row-rev" style={{
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              gap:"4rem",
              alignItems:"center",
              marginBottom:"6rem",
            }}>
              <div className="mockup-float" style={{
                background:"#221C18",
                borderRadius:"16px",
                padding:"1.75rem",
                border:"1px solid rgba(196,112,75,0.12)",
              }}>
                <div style={{
                  display:"flex", alignItems:"center", gap:"0.875rem",
                  marginBottom:"1.25rem",
                  background:"#2A2320",
                  padding:"0.75rem",
                  borderRadius:"10px",
                }}>
                  <div style={{
                    width:"36px", height:"36px",
                    background:"#171311",
                    borderRadius:"8px",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0,
                  }}>
                    <FileIcon />
                  </div>
                  <div>
                    <div style={{ color:"#EDE6DD", fontSize:"0.85rem", fontWeight:600 }}>milestone_proof.pdf</div>
                    <div style={{ color:"#A89B8C", fontSize:"0.75rem" }}>Uploaded 2 seconds ago</div>
                  </div>
                </div>
                <div style={{
                  textAlign:"center",
                  padding:"0.875rem 0",
                  borderTop:"1px solid rgba(196,112,75,0.10)",
                  borderBottom:"1px solid rgba(196,112,75,0.10)",
                  marginBottom:"1rem",
                }}>
                  <span className="spinner" />
                </div>
                <div style={{
                  display:"flex", alignItems:"center", gap:"0.5rem",
                  padding:"0.75rem",
                  background:"rgba(107,138,94,0.1)",
                  borderRadius:"10px",
                  border:"1px solid rgba(107,138,94,0.2)",
                }}>
                  <CheckIcon />
                  <span style={{ color:"#6B8A5E", fontSize:"0.85rem" }}>Milestone criteria verified</span>
                </div>
              </div>

              <div>
                <h3 style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.45rem", margin:"0 0 1rem" }}>AI-powered milestone verification</h3>
                <p style={{ color:"#A89B8C", lineHeight:1.75, margin:0 }}>
                  Upload your proof document and our AI compares it against the agreed milestone criteria. A clear YES or NO decision — no subjective judgment, no delays.
                </p>
              </div>
            </div>

            {/* Feature 3: text left, visual right */}
            <div className="scroll-animate feature-row" style={{
              display:"grid",
              gridTemplateColumns:"1fr 1fr",
              gap:"4rem",
              alignItems:"center",
            }}>
              <div>
                <h3 style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.45rem", margin:"0 0 1rem" }}>Instant settlement</h3>
                <p style={{ color:"#A89B8C", lineHeight:1.75, margin:0 }}>
                  Upon approval, RLUSD is released to the startup&apos;s wallet in 3-5 seconds. If the milestone isn&apos;t met, the investor gets an automatic refund.
                </p>
              </div>
              <div className="mockup-float" style={{
                background:"#221C18",
                borderRadius:"16px",
                padding:"1.75rem",
                border:"1px solid rgba(196,112,75,0.12)",
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.75rem" }}>
                  <span style={{ color:"#A89B8C", fontSize:"0.85rem" }}>Transaction Complete</span>
                  <CheckCircleIcon />
                </div>
                <div style={{ fontWeight:700, color:"#EDE6DD", fontSize:"1.2rem", marginBottom:"0.5rem" }}>Payment Released</div>
                <div style={{ marginBottom:"1.25rem" }}>
                  <span style={{ fontSize:"2.5rem", fontWeight:800, color:"#C4704B" }}>3.2</span>
                  <span style={{ color:"#A89B8C", marginLeft:"0.4rem" }}>seconds</span>
                </div>
                <div style={{ borderTop:"1px solid rgba(196,112,75,0.12)", paddingTop:"1rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.5rem" }}>
                    <span style={{ color:"#A89B8C", fontSize:"0.8rem" }}>Amount</span>
                    <span style={{ color:"#EDE6DD",  fontSize:"0.8rem" }}>10,000 RLUSD</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ color:"#A89B8C", fontSize:"0.8rem" }}>Network fee</span>
                    <span style={{ color:"#EDE6DD",  fontSize:"0.8rem" }}>0.000012 XRP</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── WHY XRP LEDGER ─────────────────────────────────────────────── */}
          <section style={{ padding:"6rem 2rem", maxWidth:"1100px", margin:"0 auto" }}>
            <h2 className="scroll-animate" style={{
              fontWeight:700,
              fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
              color:"#EDE6DD",
              textAlign:"center",
              marginBottom:"3rem",
              letterSpacing:"-0.02em",
            }}>
              Why we build on the XRP Ledger
            </h2>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:"1.5rem" }}>
              {[
                { color:"#C4704B", stat:"Native",   sub:"escrow",          desc:"No smart contracts needed — escrow is built into the protocol with XLS-85 support for RLUSD", delay:"" },
                { color:"#C4704B", stat:"3-5 sec",  sub:"settlement",      desc:"Transactions confirm in seconds, not minutes or hours", delay:"delay-1" },
                { color:"#D4B896", stat:"<$0.01",   sub:"per transaction", desc:"Near-zero fees make frequent settlements economically viable", delay:"delay-2" },
                { color:"#D4B896", stat:"100%",     sub:"transparent",     desc:"All escrows are visible and verifiable on-chain by both parties", delay:"delay-3" },
              ].map(({ color, stat, sub, desc, delay }) => (
                <div key={stat} className={`scroll-animate ${delay} xrp-card`} style={{
                  background:"#221C18",
                  borderRadius:"16px",
                  padding:"1.75rem",
                  border:"1px solid rgba(196,112,75,0.10)",
                  borderTop:`3px solid ${color}`,
                  transition:"transform 0.2s ease, box-shadow 0.2s ease",
                }}>
                  <div style={{ fontSize:"2.5rem", fontWeight:800, color, lineHeight:1.1, marginBottom:"0.25rem" }}>{stat}</div>
                  <div style={{ fontWeight:700, color:"#EDE6DD", marginBottom:"0.75rem" }}>{sub}</div>
                  <p style={{ color:"#A89B8C", fontSize:"0.85rem", lineHeight:1.65, margin:0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── SECURITY & TRUST ───────────────────────────────────────────── */}
          <section style={{ padding:"6rem 2rem", maxWidth:"1100px", margin:"0 auto" }}>
            <h2 className="scroll-animate" style={{
              fontWeight:700,
              fontSize:"clamp(1.8rem, 4vw, 2.6rem)",
              color:"#EDE6DD",
              textAlign:"center",
              marginBottom:"4rem",
              letterSpacing:"-0.02em",
            }}>
              Your funds, your control
            </h2>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:"2rem" }}>
              {[
                { icon:<LockIcon />,    title:"Self-custody",        desc:"Private keys never leave your wallet. You sign every transaction yourself via Xumm.", delay:"" },
                { icon:<EyeIcon />,     title:"On-chain transparency", desc:"Every escrow is visible on the XRP Ledger. Both parties can verify the status at any time.", delay:"delay-1" },
                { icon:<BalanceIcon />, title:"Automated fairness",   desc:"No human gatekeepers. AI decides based on the evidence, and the blockchain executes automatically.", delay:"delay-2" },
              ].map(({ icon, title, desc, delay }) => (
                <div key={title} className={`scroll-animate ${delay}`} style={{ textAlign:"center", padding:"1rem" }}>
                  <div style={{ color:"#C4704B", display:"flex", justifyContent:"center", marginBottom:"1rem" }}>{icon}</div>
                  <h3 style={{ fontWeight:700, color:"#EDE6DD", margin:"0 0 0.5rem" }}>{title}</h3>
                  <p style={{ color:"#A89B8C", fontSize:"0.9rem", lineHeight:1.65, margin:0 }}>{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ────────────────────────────────────────────────────────── */}
          <section style={{ padding:"8rem 2rem 9rem", textAlign:"center", position:"relative" }}>
            <div style={{
              position:"absolute", top:"50%", left:"50%",
              transform:"translate(-50%,-50%)",
              width:"800px", height:"600px",
              background:"radial-gradient(ellipse, rgba(196,112,75,0.14) 0%, transparent 70%)",
              pointerEvents:"none",
            }} />
            <h2 className="scroll-animate" style={{
              fontWeight:800,
              fontSize:"clamp(2.2rem, 5.5vw, 3.75rem)",
              color:"#EDE6DD",
              letterSpacing:"-0.03em",
              margin:"0 0 1rem",
              lineHeight:1.1,
            }}>
              Start funding milestones today.
            </h2>
            <p className="scroll-animate delay-1" style={{
              color:"#A89B8C",
              fontSize:"1.1rem",
              margin:"0 0 2.5rem",
            }}>
              Lock funds in escrow. Let AI handle the verification. Get paid instantly.
            </p>
            <div className="scroll-animate delay-2">
              <Link href={loggedIn ? "/dashboard" : "/register"}>
                <button className="btn-primary">Get Started</button>
              </Link>
              <p style={{ color:"#A89B8C", fontSize:"0.8rem", marginTop:"1rem" }}>
                Free to use on XRP Testnet
              </p>
            </div>
          </section>

          {/* ── FOOTER ─────────────────────────────────────────────────────── */}
          <footer style={{
            background:"#0F0C0A",
            borderTop:"1px solid rgba(196,112,75,0.15)",
            padding:"3rem 2rem",
          }}>
            <div style={{
              maxWidth:"1100px",
              margin:"0 auto",
              display:"grid",
              gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",
              gap:"2rem",
              alignItems:"center",
            }}>
              <div>
                <div style={{ fontWeight:700, color:"#EDE6DD", marginBottom:"0.5rem" }}>Milestone Funding</div>
                <p style={{ color:"#A89B8C", fontSize:"0.8rem", margin:0 }}>© 2026 Milestone Funding. All rights reserved.</p>
              </div>

              <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap", alignItems:"center" }}>
                <button onClick={() => scrollTo("problem")} style={{ background:"none", border:"none", color:"#A89B8C", fontSize:"0.85rem", cursor:"pointer", padding:0 }} className="footer-link">About</button>
                <button onClick={() => scrollTo("how-it-works")} style={{ background:"none", border:"none", color:"#A89B8C", fontSize:"0.85rem", cursor:"pointer", padding:0 }} className="footer-link">How it Works</button>
                <Link href="/login"    style={{ color:"#A89B8C", textDecoration:"none", fontSize:"0.85rem" }} className="footer-link">Login</Link>
                <Link href="/register" style={{ color:"#A89B8C", textDecoration:"none", fontSize:"0.85rem" }} className="footer-link">Register</Link>
              </div>

              <div style={{ color:"#A89B8C", fontSize:"0.8rem" }}>Built on XRP Ledger</div>
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}
