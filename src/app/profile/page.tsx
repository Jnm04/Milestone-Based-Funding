"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { NodeBackground } from "@/components/node-background";

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
  }, [status, router]);

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
