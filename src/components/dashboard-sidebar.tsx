"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/logo";

interface SidebarProps {
  role: "investor" | "startup";
}

const INVESTOR_NAV = [
  { href: "/dashboard/investor", label: "Dashboard", icon: IconDashboard },
  { href: "/contract/new", label: "New Contract", icon: IconPlus, dynamic: true },
  { href: "/profile", label: "Profile", icon: IconUser },
];

const STARTUP_NAV = [
  { href: "/dashboard/startup", label: "Dashboard", icon: IconDashboard },
  { href: "/profile", label: "Profile", icon: IconUser },
];

function IconDashboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function DashboardSidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const nav = role === "investor" ? INVESTOR_NAV : STARTUP_NAV;
  const walletAddress = session?.user?.walletAddress;

  // For "New Contract" we need the wallet address query param
  function getHref(item: typeof INVESTOR_NAV[0]) {
    if (item.dynamic && role === "investor" && walletAddress) {
      return `${item.href}?investor=${walletAddress}`;
    }
    return item.href;
  }

  const initials = session?.user?.name
    ? session.user.name.slice(0, 2).toUpperCase()
    : session?.user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0 h-screen sticky top-0"
        style={{
          background: "#1C1917",
          borderRight: "1px solid rgba(196,112,75,0.12)",
        }}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b" style={{ borderColor: "rgba(196,112,75,0.12)" }}>
          <Link href="/">
            <Logo variant="nav" />
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "?");
            return (
              <Link key={item.href} href={getHref(item)}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={{
                    background: isActive ? "rgba(196,112,75,0.1)" : "transparent",
                    color: isActive ? "#EDE6DD" : "#A89B8C",
                    borderLeft: isActive ? "2px solid #C4704B" : "2px solid transparent",
                  }}
                >
                  <item.icon />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(196,112,75,0.12)" }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: "rgba(196,112,75,0.15)", color: "#C4704B" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "#EDE6DD" }}>
                {session?.user?.name ?? session?.user?.email}
              </p>
              <p className="text-xs truncate" style={{ color: "#A89B8C" }}>
                {role === "investor" ? "Grant Giver" : "Receiver"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left transition-all"
            style={{ color: "#A89B8C" }}
            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EDE6DD"; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#A89B8C"; }}
          >
            <IconLogout />
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-3"
        style={{
          background: "#1C1917",
          borderTop: "1px solid rgba(196,112,75,0.12)",
        }}
      >
        {nav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={getHref(item)}>
              <div
                className="flex flex-col items-center gap-1 px-4 py-1"
                style={{ color: isActive ? "#C4704B" : "#A89B8C" }}
              >
                <item.icon />
                <span className="text-xs">{item.label}</span>
              </div>
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex flex-col items-center gap-1 px-4 py-1"
          style={{ color: "#A89B8C" }}
        >
          <IconLogout />
          <span className="text-xs">Sign out</span>
        </button>
      </nav>
    </>
  );
}
