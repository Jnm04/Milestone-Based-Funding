"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NodeBackground } from "@/components/node-background";

// ── Telegram state ─────────────────────────────────────────────────────────
interface TelegramStatus { configured: boolean; connected: boolean; connectedAt: string | null }

// ── Webhook state ──────────────────────────────────────────────────────────
interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const ALL_WEBHOOK_EVENTS = [
  "contract.created", "contract.funded", "contract.expired",
  "proof.submitted", "ai.decision", "manual_review.required",
  "manual_review.resolved", "funds.released", "contract.rejected",
];

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  walletAddress: string | null;
  companyName: string | null;
  department: string | null;
  jobTitle: string | null;
  phone: string | null;
  bio: string | null;
  website: string | null;
  createdAt: string;
  notifyProofSubmitted: boolean;
  notifyPendingReview: boolean;
  notifyMilestoneCompleted: boolean;
  notifyFunded: boolean;
  notifyVerified: boolean;
  notifyRejected: boolean;
}

/* ── Password eye icon ────────────────────────────────────── */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/* ── Notification toggle ──────────────────────────────────── */
function NotifyToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: "1px solid rgba(196,112,75,0.1)" }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>{label}</span>
        <span className="text-xs" style={{ color: "#A89B8C" }}>{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="cs-toggle"
        data-checked={checked}
        style={{
          background: checked ? "#C4704B" : "rgba(255,255,255,0.1)",
        }}
      >
        <span
          style={{
            display: "block",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#EDE6DD",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transform: checked ? "translateX(20px)" : "translateX(2px)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────── */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-5 rounded-2xl p-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(196,112,75,0.15)",
        borderTop: "1px solid #C4704B",
      }}
    >
      <div className="flex flex-col gap-0.5">
        <h2 style={{ color: "#EDE6DD", fontFamily: "var(--font-libre-franklin)", fontWeight: 500, fontSize: 16 }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs" style={{ color: "#A89B8C" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  const [notifyProofSubmitted, setNotifyProofSubmitted] = useState(true);
  const [notifyPendingReview, setNotifyPendingReview] = useState(true);
  const [notifyMilestoneCompleted, setNotifyMilestoneCompleted] = useState(true);
  const [notifyFunded, setNotifyFunded] = useState(true);
  const [notifyVerified, setNotifyVerified] = useState(true);
  const [notifyRejected, setNotifyRejected] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Telegram
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [showNewWebhook, setShowNewWebhook] = useState(false);
  const [whUrl, setWhUrl] = useState("");
  const [whEvents, setWhEvents] = useState<string[]>(["contract.funded", "proof.submitted", "ai.decision", "funds.released"]);
  const [whSaving, setWhSaving] = useState(false);
  const [whSecret, setWhSecret] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ user }) => {
        setProfile(user);
        setName(user.name ?? "");
        setCompanyName(user.companyName ?? "");
        setDepartment(user.department ?? "");
        setJobTitle(user.jobTitle ?? "");
        setPhone(user.phone ?? "");
        setBio(user.bio ?? "");
        setWebsite(user.website ?? "");
        setNotifyProofSubmitted(user.notifyProofSubmitted);
        setNotifyPendingReview(user.notifyPendingReview);
        setNotifyMilestoneCompleted(user.notifyMilestoneCompleted);
        setNotifyFunded(user.notifyFunded);
        setNotifyVerified(user.notifyVerified);
        setNotifyRejected(user.notifyRejected);
      });
    // Load Telegram status
    fetch("/api/telegram/connect")
      .then((r) => r.json())
      .then((d) => setTgStatus(d))
      .catch(() => {});
    // Load webhooks
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((d) => setWebhooks(d.endpoints ?? []))
      .catch(() => {});
  }, [status, router]);

  async function handleTelegramConnect() {
    setTgLoading(true);
    setTgDeepLink(null);
    try {
      const res = await fetch("/api/telegram/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate link");
      setTgDeepLink(data.deepLink);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleTelegramDisconnect() {
    setTgLoading(true);
    try {
      await fetch("/api/telegram/connect", { method: "DELETE" });
      setTgStatus((prev) => ({ configured: prev?.configured ?? false, connected: false, connectedAt: null }));
      setTgDeepLink(null);
      toast.success("Telegram disconnected.");
    } catch {
      toast.error("Failed to disconnect.");
    } finally {
      setTgLoading(false);
    }
  }

  async function handleAddWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!whUrl.startsWith("https://")) { toast.error("URL must start with https://"); return; }
    if (whEvents.length === 0) { toast.error("Select at least one event."); return; }
    setWhSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: whUrl, events: whEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setWebhooks((prev) => [data.endpoint, ...prev]);
      setWhSecret(data.secret);
      setWhUrl("");
      setWhEvents(["contract.funded", "proof.submitted", "ai.decision", "funds.released"]);
      setShowNewWebhook(false);
      toast.success("Webhook added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setWhSaving(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook removed.");
    } catch {
      toast.error("Failed to remove webhook.");
    }
  }

  async function handleToggleWebhook(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("Failed");
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w));
    } catch {
      toast.error("Failed to update webhook.");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, companyName, department, jobTitle, phone, bio, website }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setSavingPw(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password changed.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error changing password.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotify(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyProofSubmitted, notifyPendingReview, notifyMilestoneCompleted,
          notifyFunded, notifyVerified, notifyRejected,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Notifications saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving settings.");
    } finally {
      setSavingNotify(false);
    }
  }

  const role = (profile?.role ?? session?.user?.role ?? "INVESTOR") as "INVESTOR" | "STARTUP";
  const dashboardHref = role === "INVESTOR" ? "/dashboard/investor" : "/dashboard/startup";
  const initials = (name || profile?.email || "?").slice(0, 2).toUpperCase();

  if (status === "loading" || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#171311" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgba(196,112,75,0.4)", borderTopColor: "#C4704B" }} />
          <span className="text-sm" style={{ color: "#A89B8C" }}>Loading profile…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#171311", color: "#EDE6DD" }}>
      <NodeBackground />

      {/* Sidebar */}
      <DashboardSidebar role={role === "INVESTOR" ? "investor" : "startup"} />

      {/* Main */}
      <main className="flex-1 min-w-0 md:ml-64">

        {/* Top bar */}
        <div
          className="sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "rgba(23,19,17,0.92)",
            backdropFilter: "blur(20px)",
            borderBottomColor: "rgba(196,112,75,0.12)",
          }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: "#A89B8C" }}>
            <Link href={dashboardHref} className="transition-colors hover:text-[#EDE6DD]">Dashboard</Link>
            <span>/</span>
            <span style={{ color: "#EDE6DD" }}>Profile</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs transition-colors"
            style={{ color: "#A89B8C" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#EDE6DD")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#A89B8C")}
          >
            Sign out
          </button>
        </div>

        <div className="max-w-2xl mx-auto py-10 px-6 flex flex-col gap-8">

          {/* Avatar + header */}
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-xl font-semibold"
              style={{
                background: "rgba(196,112,75,0.15)",
                border: "1px solid rgba(196,112,75,0.3)",
                color: "#C4704B",
                fontFamily: "var(--font-libre-franklin)",
              }}
            >
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <h1
                style={{
                  fontFamily: "var(--font-libre-franklin), sans-serif",
                  fontWeight: 300,
                  fontSize: "clamp(22px, 4vw, 30px)",
                  color: "#EDE6DD",
                }}
              >
                {name || profile.email}
              </h1>
              <span
                className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest self-start"
                style={{
                  background: "rgba(196,112,75,0.1)",
                  border: "1px solid rgba(196,112,75,0.25)",
                  color: "#C4704B",
                }}
              >
                {role === "INVESTOR" ? "Grant Giver" : "Receiver"}
              </span>
            </div>
          </div>

          {/* Profile Information */}
          <SectionCard title="Profile Information" subtitle="Your personal and professional details">

            <div className="flex flex-col gap-1">
              <label className="cs-label">Email</label>
              <div
                className="px-3 py-2.5 rounded-xl text-sm font-mono"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(196,112,75,0.1)",
                  color: "#A89B8C",
                }}
              >
                {profile.email}
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Full Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Company Name</label>
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Position / Title</label>
                  <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="CEO, CFO, Founder…" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Department</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Finance, Engineering…" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 890" className="cs-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Website</label>
                  <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="cs-input" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="cs-label">About / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Short description…"
                  rows={3}
                  className="cs-input resize-none"
                  style={{ height: "auto" }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="cs-label">EVM Wallet (MetaMask)</label>
                <div
                  className="px-3 py-2.5 rounded-xl text-xs font-mono break-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(196,112,75,0.1)",
                    color: profile.walletAddress ? "#EDE6DD" : "#A89B8C",
                  }}
                >
                  {profile.walletAddress ?? "No wallet connected yet"}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#A89B8C" }}>Connect via the dashboard.</p>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="cs-btn-primary cs-btn-sm">
                  {saving ? "Saving…" : "Save Profile"}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Email Notifications */}
          <SectionCard title="Email Notifications" subtitle="Choose when you want to be notified by email">
            <div className="flex flex-col">
              {role === "INVESTOR" && (
                <>
                  <NotifyToggle label="Proof submitted" description="Receiver has submitted proof for a milestone" checked={notifyProofSubmitted} onChange={setNotifyProofSubmitted} />
                  <NotifyToggle label="Manual review required" description="The AI is uncertain — your assessment is needed" checked={notifyPendingReview} onChange={setNotifyPendingReview} />
                  <NotifyToggle label="Milestone completed" description="Payment has been successfully released" checked={notifyMilestoneCompleted} onChange={setNotifyMilestoneCompleted} />
                </>
              )}
              {role === "STARTUP" && (
                <>
                  <NotifyToggle label="Milestone funded" description="A Grant Giver has funded your milestone with RLUSD" checked={notifyFunded} onChange={setNotifyFunded} />
                  <NotifyToggle label="Proof approved" description="AI accepted your proof — payment is being released" checked={notifyVerified} onChange={setNotifyVerified} />
                  <NotifyToggle label="Proof rejected" description="AI rejected your proof — resubmission is possible" checked={notifyRejected} onChange={setNotifyRejected} />
                </>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={handleSaveNotifications} disabled={savingNotify} className="cs-btn-ghost cs-btn-sm">
                {savingNotify ? "Saving…" : "Save Settings"}
              </button>
            </div>
          </SectionCard>

          {/* Change Password */}
          <SectionCard title="Change Password">
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="cs-label">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="cs-input"
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#A89B8C" }} tabIndex={-1}>
                    <EyeIcon open={showCurrent} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">New Password</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="cs-input" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#A89B8C" }} tabIndex={-1}>
                      <EyeIcon open={showNew} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="cs-input" style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#A89B8C" }} tabIndex={-1}>
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingPw} className="cs-btn-ghost cs-btn-sm">
                  {savingPw ? "Changing…" : "Change Password"}
                </button>
              </div>
            </form>
          </SectionCard>

          {/* Telegram Notifications */}
          <SectionCard title="Telegram Notifications" subtitle="Get instant push notifications directly in Telegram — no inbox required.">
            {tgStatus && !tgStatus.configured ? (
              <div className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}>
                <span className="text-sm font-medium" style={{ color: "#D4B896" }}>Coming soon</span>
                <p className="text-xs" style={{ color: "#A89B8C" }}>
                  Telegram notifications will be available once the bot is activated. Check back soon!
                </p>
              </div>
            ) : tgStatus?.connected ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: "#22c55e" }} />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium" style={{ color: "#EDE6DD" }}>Connected</span>
                    {tgStatus.connectedAt && (
                      <span className="text-xs" style={{ color: "#A89B8C" }}>
                        Since {new Date(tgStatus.connectedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={tgLoading}
                  onClick={handleTelegramDisconnect}
                  className="text-xs self-start transition-colors disabled:opacity-50"
                  style={{ color: "#A89B8C" }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#A89B8C")}
                >
                  {tgLoading ? "…" : "Disconnect Telegram"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm" style={{ color: "#A89B8C" }}>
                  Click below to generate a one-time link. Open it in Telegram to connect your account.
                </p>
                {tgDeepLink ? (
                  <div className="flex flex-col gap-3">
                    <a
                      href={tgDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-colors"
                      style={{ background: "#229ED9", color: "#fff", display: "block" }}
                    >
                      Open in Telegram →
                    </a>
                    <p className="text-xs text-center" style={{ color: "#A89B8C" }}>Link expires in 15 minutes. Reload this page after connecting to see your status.</p>
                    <button
                      type="button"
                      onClick={handleTelegramConnect}
                      className="text-xs self-center"
                      style={{ color: "#A89B8C" }}
                    >
                      Generate new link
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={tgLoading}
                    onClick={handleTelegramConnect}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ background: "#229ED9", color: "#fff" }}
                  >
                    {tgLoading ? "Generating link…" : "Connect Telegram"}
                  </button>
                )}
              </div>
            )}
          </SectionCard>

          {/* Webhooks */}
          <SectionCard title="Webhooks" subtitle="Send signed POST requests to your systems on every contract event.">
            {whSecret && (
              <div className="flex flex-col gap-2 p-4 rounded-xl mb-2" style={{ background: "rgba(196,112,75,0.08)", border: "1px solid rgba(196,112,75,0.3)" }}>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#C4704B" }}>Save this secret — shown only once</span>
                <code className="text-xs font-mono break-all select-all p-2 rounded" style={{ background: "rgba(0,0,0,0.3)", color: "#EDE6DD" }}>{whSecret}</code>
                <p className="text-xs" style={{ color: "#A89B8C" }}>Verify incoming requests: <code style={{ color: "#D4B896" }}>HMAC-SHA256(secret, rawBody) === X-Cascrow-Signature</code></p>
                <button type="button" onClick={() => setWhSecret(null)} className="text-xs self-end" style={{ color: "#A89B8C" }}>Dismiss</button>
              </div>
            )}

            {webhooks.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="flex items-start gap-3 p-3 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)" }}>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <code className="text-xs font-mono truncate" style={{ color: "#EDE6DD" }}>{wh.url}</code>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {wh.events.map((ev) => (
                          <span key={ev} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(196,112,75,0.1)", color: "#C4704B" }}>{ev}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleWebhook(wh.id, !wh.active)}
                        className="text-xs"
                        style={{ color: wh.active ? "#22c55e" : "#A89B8C" }}
                      >
                        {wh.active ? "Active" : "Paused"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWebhook(wh.id)}
                        className="text-xs"
                        style={{ color: "#A89B8C" }}
                        onMouseOver={(e) => (e.currentTarget.style.color = "#ef4444")}
                        onMouseOut={(e) => (e.currentTarget.style.color = "#A89B8C")}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showNewWebhook ? (
              <form onSubmit={handleAddWebhook} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">HTTPS Endpoint URL</label>
                  <input
                    type="url"
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://your-server.com/webhook"
                    className="cs-input"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cs-label">Events to subscribe</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_WEBHOOK_EVENTS.map((ev) => {
                      const checked = whEvents.includes(ev);
                      return (
                        <button
                          key={ev}
                          type="button"
                          onClick={() => setWhEvents((prev) => checked ? prev.filter((e) => e !== ev) : [...prev, ev])}
                          className="text-xs px-2.5 py-1 rounded-full transition-colors"
                          style={{
                            background: checked ? "rgba(196,112,75,0.2)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${checked ? "#C4704B" : "rgba(196,112,75,0.2)"}`,
                            color: checked ? "#C4704B" : "#A89B8C",
                          }}
                        >
                          {ev}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={whSaving} className="cs-btn-ghost cs-btn-sm">
                    {whSaving ? "Adding…" : "Add Webhook"}
                  </button>
                  <button type="button" onClick={() => setShowNewWebhook(false)} className="cs-btn-ghost cs-btn-sm" style={{ opacity: 0.6 }}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewWebhook(true)}
                className="cs-btn-ghost cs-btn-sm self-start"
              >
                + Add Endpoint
              </button>
            )}
          </SectionCard>

          {/* Account Info */}
          <SectionCard title="Account">
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center justify-between py-3 text-sm"
                style={{ borderBottom: "1px solid rgba(196,112,75,0.1)" }}
              >
                <span style={{ color: "#A89B8C" }}>Member since</span>
                <span style={{ color: "#EDE6DD" }}>
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 text-sm">
                <span style={{ color: "#A89B8C" }}>Role</span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-widest"
                  style={{
                    background: "rgba(196,112,75,0.1)",
                    border: "1px solid rgba(196,112,75,0.25)",
                    color: "#C4704B",
                  }}
                >
                  {role === "INVESTOR" ? "Grant Giver" : "Receiver"}
                </span>
              </div>
            </div>
          </SectionCard>

        </div>
      </main>
    </div>
  );
}
