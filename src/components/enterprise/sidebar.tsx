"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  {
    href: "/enterprise/dashboard",
    label: "Overview",
    exact: true,
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/enterprise/dashboard/attestations",
    label: "Attestations",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: "/enterprise/dashboard/certificates",
    label: "Certificates",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/enterprise/dashboard/auditors",
    label: "Auditor Access",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

const BOTTOM_NAV = [
  {
    href: "/enterprise/dashboard/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

interface Props {
  user: { name: string | null; email: string; company: string | null };
}

export function EnterpriseSidebar({ user }: Props) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : (pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href));
  }

  const initials = (user.company ?? user.name ?? user.email)
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside style={{
      width: 232,
      minHeight: "100vh",
      background: "white",
      borderRight: "1px solid var(--ent-border)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      height: "100vh",
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid var(--ent-border)" }}>
        <Link href="/enterprise/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30,
            height: 30,
            background: "var(--ent-accent)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 1px 4px rgba(29,78,216,0.3)",
          }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M4 9c0-2.761 2.239-5 5-5s5 2.239 5 5-2.239 5-5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="9" cy="9" r="1.5" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>cascrow</div>
            <div style={{ fontSize: 10, color: "var(--ent-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Enterprise</div>
          </div>
        </Link>
      </div>

      {/* Main nav */}
      <nav style={{ padding: "10px 10px 0", flex: 1 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--ent-muted)", padding: "6px 8px 4px", margin: 0 }}>
          Workspace
        </p>
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} />
          );
        })}

        <div style={{ height: 1, background: "var(--ent-border)", margin: "10px 8px" }} />

        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--ent-muted)", padding: "6px 8px 4px", margin: 0 }}>
          Account
        </p>
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={active} />
          );
        })}
      </nav>

      {/* Help link */}
      <div style={{ padding: "12px 10px", borderTop: "none" }}>
        <a
          href="mailto:support@cascrow.com"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderRadius: 7,
            fontSize: 12.5,
            color: "var(--ent-muted)",
            textDecoration: "none",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ent-bg)"; e.currentTarget.style.color = "var(--ent-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--ent-muted)"; }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Help & Support
        </a>
      </div>

      {/* User section */}
      <div style={{ padding: "14px 16px", borderTop: "1px solid var(--ent-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#EFF6FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 800,
            color: "var(--ent-accent)",
            flexShrink: 0,
            border: "1.5px solid #BFDBFE",
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.company ?? user.name ?? "Your Company"}
            </div>
            <div style={{ fontSize: 11, color: "var(--ent-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          </div>
          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <NotificationBell />
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <Link
            href="/profile"
            style={{
              flex: 1,
              fontSize: 12,
              color: "var(--ent-muted)",
              textDecoration: "none",
              padding: "5px 8px",
              borderRadius: 6,
              background: "var(--ent-bg)",
              border: "1px solid var(--ent-border)",
              textAlign: "center",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ent-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ent-muted)"; }}
          >
            Profile
          </Link>
          <Link
            href="/api/auth/signout"
            style={{
              flex: 1,
              fontSize: 12,
              color: "var(--ent-muted)",
              textDecoration: "none",
              padding: "5px 8px",
              borderRadius: 6,
              background: "var(--ent-bg)",
              border: "1px solid var(--ent-border)",
              textAlign: "center",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ent-text)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ent-muted)"; }}
          >
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 7,
        marginBottom: 1,
        fontSize: 13.5,
        fontWeight: active ? 600 : 450,
        color: active ? "var(--ent-accent)" : "var(--ent-muted)",
        background: active ? "#EFF6FF" : "transparent",
        textDecoration: "none",
        transition: "all 0.12s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "var(--ent-bg)";
          e.currentTarget.style.color = "var(--ent-text)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--ent-muted)";
        }
      }}
    >
      {active && (
        <span style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 3,
          height: 18,
          borderRadius: "0 3px 3px 0",
          background: "var(--ent-accent)",
        }} />
      )}
      <span style={{ opacity: active ? 1 : 0.65, flexShrink: 0 }}>{icon}</span>
      {label}
    </Link>
  );
}
