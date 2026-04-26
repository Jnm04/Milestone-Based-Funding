"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    fetch("/api/notifications")
      .then(r => r.json())
      .then((d: { notifications?: Notification[]; unreadCount?: number }) => {
        setNotifications(d.notifications ?? []);
        setUnread(d.unreadCount ?? 0);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: "relative", color: "#A89B8C", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6 }}
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: "50%", background: "#C4704B", color: "white", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: "min(320px, calc(100vw - 16px))", maxHeight: 400, overflowY: "auto", background: "#1C1917", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(196,112,75,0.1)" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#EDE6DD" }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: "#C4704B", background: "none", border: "none", cursor: "pointer" }}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p style={{ padding: "20px 16px", fontSize: 13, color: "#A89B8C", textAlign: "center" }}>No notifications yet</p>
          ) : (
            notifications.slice(0, 8).map(n => {
              const inner = (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) markRead(n.id); setOpen(false); }}
                  style={{ padding: "10px 16px", borderBottom: "1px solid rgba(196,112,75,0.06)", background: n.read ? "transparent" : "rgba(196,112,75,0.05)", cursor: n.href ? "pointer" : "default", display: "flex", gap: 10, alignItems: "flex-start" }}
                >
                  {!n.read && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#C4704B", marginTop: 5, flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0, paddingLeft: n.read ? 17 : 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "#EDE6DD", marginBottom: 2 }}>{n.title}</p>
                    <p style={{ fontSize: 12, color: "#A89B8C", lineHeight: 1.4 }}>{n.body}</p>
                    <p style={{ fontSize: 11, color: "#6B5E54", marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} style={{ textDecoration: "none" }}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            style={{ display: "block", padding: "10px 16px", textAlign: "center", fontSize: 12, color: "#C4704B", borderTop: "1px solid rgba(196,112,75,0.1)", textDecoration: "none" }}
          >
            View all notifications →
          </Link>
        </div>
      )}
    </div>
  );
}
