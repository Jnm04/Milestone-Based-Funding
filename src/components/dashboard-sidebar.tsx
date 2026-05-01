"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";

interface SidebarProps {
  role: "investor" | "startup";
}

const INVESTOR_NAV = [
  { href: "/dashboard/investor", label: "Dashboard", icon: IconDashboard },
  { href: "/contract/new", label: "New Contract", icon: IconPlus, dynamic: true },
  { href: "/profile", label: "Profile", icon: IconUser },
  { href: "/support", label: "Support", icon: IconSupport },
];

const STARTUP_NAV = [
  { href: "/dashboard/startup", label: "Dashboard", icon: IconDashboard },
  { href: "/profile", label: "Profile", icon: IconUser },
  { href: "/support", label: "Support", icon: IconSupport },
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
function IconSupport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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

  const primaryColor = "hsl(22 55% 54%)";
  const mutedColor = "hsl(30 10% 62%)";
  const fgColor = "hsl(32 35% 92%)";
  const borderColor = "hsl(28 18% 14%)";
  const bgSidebar = "hsl(24 12% 6%)";

  return (
    <>
      {/* ── Desktop sidebar (Lovable style) ── */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0"
        style={{ background: `${bgSidebar}`, borderRight: `1px solid ${borderColor}`, backdropFilter: "blur(20px)" }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-5 border-b" style={{ borderColor }}>
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight">cascrow</span>
          </Link>
          <span className="ml-auto rounded-full border px-2 py-0.5" style={{ borderColor, background: "hsl(24 14% 4% / 0.6)", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: "uppercase" as const, letterSpacing: "0.2em", color: mutedColor }}>app</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "?");
            return (
              <Link key={item.href} href={getHref(item)}>
                <div
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    background: isActive ? "hsl(24 12% 8%)" : "transparent",
                    color: isActive ? fgColor : mutedColor,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "hsl(24 12% 8% / 0.6)"; (e.currentTarget as HTMLDivElement).style.color = fgColor; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent"; if (!isActive) (e.currentTarget as HTMLDivElement).style.color = mutedColor; }}
                >
                  <span style={{ color: isActive ? primaryColor : "inherit" }}><item.icon /></span>
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t space-y-3" style={{ borderColor }}>
          {/* Wallet pill */}
          {session?.user?.walletAddress && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor, background: "hsl(24 14% 4% / 0.6)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: primaryColor, flexShrink: 0 }}><rect x="1" y="7" width="22" height="14" rx="2"/><path d="M16 3H5a2 2 0 0 0-2 2v2"/><circle cx="17" cy="14" r="2"/></svg>
              <span className="flex-1 min-w-0 truncate" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: mutedColor }}>
                {session.user.walletAddress.slice(0, 6)}…{session.user.walletAddress.slice(-4)}
              </span>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: primaryColor }} />
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2">
            {session?.user?.avatarUrl ? (
              <img src={session.user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0" style={{ border: `1px solid ${borderColor}` }} />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: "hsl(22 55% 54% / 0.15)", color: primaryColor }}>
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: fgColor }}>{session?.user?.name ?? session?.user?.email}</p>
              <p className="text-xs truncate" style={{ color: mutedColor, fontFamily: "'JetBrains Mono', monospace" }}>{role === "investor" ? "investor" : "startup"}</p>
            </div>
            <NotificationBell />
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg w-full text-left text-xs transition-colors"
            style={{ color: mutedColor }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "hsl(24 12% 8% / 0.6)"; (e.currentTarget as HTMLButtonElement).style.color = fgColor; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = mutedColor; }}
          >
            <IconLogout />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-3" style={{ background: bgSidebar, borderTop: `1px solid ${borderColor}` }}>
        {nav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={getHref(item)}>
              <div className="flex flex-col items-center gap-1 px-4 py-1" style={{ color: isActive ? primaryColor : mutedColor }}>
                <item.icon />
                <span className="text-xs">{item.label}</span>
              </div>
            </Link>
          );
        })}
        <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex flex-col items-center gap-1 px-4 py-1" style={{ color: mutedColor }}>
          <IconLogout />
          <span className="text-xs">Sign out</span>
        </button>
      </nav>
    </>
  );
}
