"use client";

import React from "react";
import Link from "next/link";
import { FOOTER_LOGOS, type FooterLogoItem } from "@/components/brand-icons";

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

export function SiteFooter() {
  return (
    <footer
      className="px-6 border-t"
      style={{ background: "#171311", borderColor: "rgba(196,112,75,0.12)", position: "relative", zIndex: 1 }}
    >
      {/* Row 1 — branding + main nav */}
      <div className="max-w-6xl mx-auto flex items-center justify-between py-6 text-sm" style={{ color: "#A89B8C" }}>
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
          <Link href="/terms"       className="transition-colors hover:text-[#A89B8C]">Terms</Link>
          <Link href="/datenschutz" className="transition-colors hover:text-[#A89B8C]">Privacy</Link>
          <Link href="/risiken"     className="transition-colors hover:text-[#A89B8C]">Risk Disclosure</Link>
          <Link href="/widerruf"    className="transition-colors hover:text-[#A89B8C]">Withdrawal</Link>
          <Link href="/avv"         className="transition-colors hover:text-[#A89B8C]">DPA</Link>
        </div>
      </div>
    </footer>
  );
}
