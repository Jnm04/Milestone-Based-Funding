"use client";

import React from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/#problem", label: "Problem" },
  { href: "/#how",     label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/guide",    label: "Guide" },
  { href: "/waitlist", label: "Waitlist" },
];

const primary = "hsl(22 55% 54%)";
const muted   = "hsl(30 10% 62%)";
const fg      = "hsl(32 35% 92%)";
const border  = "hsl(28 18% 14%)";
const bg      = "hsl(24 12% 6% / 0.6)";

interface SiteNavProps {
  activePage?: string;
}

export function SiteNav({ activePage }: SiteNavProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="container-tight mt-4">
        <nav className="gradient-border flex items-center justify-between rounded-full px-5 py-2.5" style={{ background: bg, backdropFilter: "blur(20px)" }}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: fg }}>cascrow</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm transition-colors hover:text-foreground"
                style={{ color: activePage === label ? primary : muted }}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden sm:inline-flex text-sm px-3 py-1.5 transition-colors hover:text-foreground" style={{ color: muted }}>Login</Link>
            <Link href="/register" className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}>Register</Link>

            <button
              className="md:hidden flex flex-col justify-center items-center gap-1.5 w-8 h-8 ml-2"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <span style={{ display: "block", width: 18, height: 1.5, borderRadius: 2, background: fg, transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "translateY(5.5px) rotate(45deg)" : "none" }} />
              <span style={{ display: "block", width: 18, height: 1.5, borderRadius: 2, background: fg, transition: "opacity 0.2s", opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: "block", width: 18, height: 1.5, borderRadius: 2, background: fg, transition: "transform 0.2s, opacity 0.2s", transform: menuOpen ? "translateY(-5.5px) rotate(-45deg)" : "none" }} />
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div className="md:hidden mt-2 rounded-2xl border flex flex-col gap-1 px-4 py-4" style={{ background: "hsl(24 12% 6% / 0.97)", backdropFilter: "blur(20px)", borderColor: border }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={label} href={href} onClick={() => setMenuOpen(false)}
                className="block py-3 text-sm border-b transition-colors"
                style={{ color: activePage === label ? primary : muted, borderColor: "hsl(28 18% 14% / 0.4)" }}
              >{label}</Link>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm text-center py-2.5 rounded-full border transition-colors" style={{ color: muted, borderColor: border }}>Login</Link>
              <Link href="/register" onClick={() => setMenuOpen(false)} className="text-sm text-center py-3 rounded-full font-medium" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}>Register</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
