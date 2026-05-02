"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

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
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const PAGE_SIZE = 30;

export default function NotificationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const role = (session?.user?.role ?? "INVESTOR") as "INVESTOR" | "STARTUP";
  const dashboardHref = role === "INVESTOR" ? "/dashboard/investor" : "/dashboard/startup";

  const load = useCallback(async (p: number, f: "all" | "unread") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (f === "unread") params.set("filter", "unread");
      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json() as { notifications?: Notification[]; unreadCount?: number; total?: number };
      setNotifications(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") load(page, filter);
  }, [status, page, filter, load, router]);

  function handleFilterChange(f: "all" | "unread") {
    setFilter(f);
    setPage(1);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnread(0);
    } finally {
      setMarkingAll(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (status === "loading") return null;

  return (
    <div className="min-h-screen flex" style={{ background: "hsl(24 14% 4%)", color: "hsl(32 35% 92%)" }}>
      <DashboardSidebar role={role === "INVESTOR" ? "investor" : "startup"} />

      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <div
          className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b"
          style={{ background: "hsl(24 14% 4% / 0.92)", backdropFilter: "blur(20px)", borderBottomColor: "hsl(22 55% 54% / 0.12)" }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: "hsl(30 10% 62%)" }}>
            <Link href={dashboardHref} className="transition-colors hover:text-[#EDE6DD]">Dashboard</Link>
            <span>/</span>
            <span style={{ color: "hsl(32 35% 92%)" }}>Notifications</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-light mb-1" style={{ color: "hsl(32 35% 92%)" }}>Notifications</h1>
              {unread > 0 && (
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>{unread} unread</p>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                disabled={markingAll}
                className="text-sm px-4 py-2 rounded-lg transition-colors"
                style={{ background: "hsl(22 55% 54% / 0.1)", border: "1px solid hsl(22 55% 54% / 0.2)", color: "hsl(22 55% 54%)", cursor: markingAll ? "not-allowed" : "pointer" }}
              >
                {markingAll ? "Marking…" : "Mark all read"}
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex border-b mb-4" style={{ borderColor: "hsl(22 55% 54% / 0.15)" }}>
            {(["all", "unread"] as const).map(f => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className="px-4 py-2 text-sm font-medium capitalize transition-colors"
                style={{
                  color: filter === f ? "hsl(32 35% 92%)" : "hsl(30 10% 62%)",
                  background: "none",
                  border: "none",
                  borderBottom: filter === f ? "2px solid hsl(22 55% 54%)" : "2px solid transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {f === "all" ? "All" : `Unread${unread > 0 ? ` (${unread})` : ""}`}
              </button>
            ))}
          </div>

          {/* List */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid hsl(22 55% 54% / 0.1)" }}
          >
            {loading ? (
              <div className="flex flex-col">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="px-5 py-4 border-b" style={{ borderColor: "hsl(22 55% 54% / 0.06)" }}>
                    <div className="h-3 w-48 rounded mb-2" style={{ background: "hsl(28 18% 14% / 0.6)" }} />
                    <div className="h-2.5 w-64 rounded" style={{ background: "hsl(24 12% 6% / 0.6)" }} />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: "hsl(22 55% 54% / 0.1)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(22 55% 54%)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "hsl(32 35% 92%)" }}>
                  {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                </p>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                  {filter === "unread" ? "You're all caught up." : "Activity on your contracts will appear here."}
                </p>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const isLast = idx === notifications.length - 1;
                const row = (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.read) markRead(n.id); }}
                    className="flex gap-3 items-start px-5 py-4 transition-colors"
                    style={{
                      background: n.read ? "transparent" : "hsl(22 55% 54% / 0.04)",
                      borderBottom: isLast ? "none" : "1px solid hsl(22 55% 54% / 0.06)",
                      cursor: n.href ? "pointer" : "default",
                    }}
                    onMouseOver={e => { if (!n.read) (e.currentTarget as HTMLDivElement).style.background = "hsl(22 55% 54% / 0.08)"; }}
                    onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "transparent" : "hsl(22 55% 54% / 0.04)"; }}
                  >
                    <div className="mt-1.5 shrink-0" style={{ width: 7, height: 7, borderRadius: "50%", background: n.read ? "transparent" : "hsl(22 55% 54%)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: "hsl(32 35% 92%)" }}>{n.title}</p>
                      <p className="text-xs leading-relaxed mb-1" style={{ color: "hsl(30 10% 62%)" }}>{n.body}</p>
                      <p className="text-xs" style={{ color: "hsl(28 14% 36%)" }}>{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} style={{ textDecoration: "none", display: "block" }}>{row}</Link>
                ) : (
                  <div key={n.id}>{row}</div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid hsl(22 55% 54% / 0.1)" }}>
              <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "hsl(24 12% 6% / 0.6)", border: "1px solid hsl(22 55% 54% / 0.12)", color: page === 1 ? "hsl(28 14% 36%)" : "hsl(30 10% 62%)", cursor: page === 1 ? "not-allowed" : "pointer" }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "hsl(24 12% 6% / 0.6)", border: "1px solid hsl(22 55% 54% / 0.12)", color: page === totalPages ? "hsl(28 14% 36%)" : "hsl(30 10% 62%)", cursor: page === totalPages ? "not-allowed" : "pointer" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
