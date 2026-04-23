"use client";

import React from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/#problem",    label: "Why us" },
  { href: "/#how",        label: "How it works" },
  { href: "/#features",   label: "Features" },
  { href: "/#enterprise", label: "Enterprise" },
  { href: "/guide",       label: "Guide" },
];

function LogoMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B" }} />
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
        <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
      </div>
      <span style={{ fontFamily: "var(--font-libre-franklin), sans-serif", fontWeight: 300, fontSize: 16, color: "#EDE6DD", letterSpacing: "4px" }}>
        cascrow
      </span>
    </div>
  );
}

interface SiteNavProps {
  activePage?: string;
}

export function SiteNav({ activePage }: SiteNavProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <nav
      className="sticky top-0 z-40 border-b"
      style={{ background: "rgba(23,19,17,0.92)", backdropFilter: "blur(20px)", borderBottomColor: "rgba(196,112,75,0.12)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/"><LogoMark /></Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#A89B8C" }}>
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{ color: activePage === label ? "#C4704B" : undefined }}
              className="transition-colors hover:text-[#EDE6DD]"
            >
              {label}
            </Link>
          ))}
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
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: "12px 4px",
                fontSize: 15,
                color: activePage === label ? "#C4704B" : "#A89B8C",
                borderBottom: "1px solid rgba(196,112,75,0.07)",
                display: "block",
              }}
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
  );
}
