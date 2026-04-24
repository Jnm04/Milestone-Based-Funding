"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";

interface UserProfile {
  name: string | null;
  email: string;
  companyName: string | null;
  department: string | null;
  jobTitle: string | null;
  notifyProofSubmitted: boolean;
  notifyPendingReview: boolean;
  notifyMilestoneCompleted: boolean;
  notifyFunded: boolean;
  notifyVerified: boolean;
  notifyRejected: boolean;
}

const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Zurich",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
];

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2025)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2025)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2025-12-31)" },
  { value: "D MMM YYYY", label: "D MMM YYYY (31 Dec 2025)" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "nl", label: "Nederlands" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 40,
        height: 22,
        borderRadius: 99,
        border: "none",
        cursor: "pointer",
        background: checked ? "var(--ent-accent)" : "#CBD5E1",
        transition: "background 0.2s",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute",
        left: checked ? 20 : 2,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
  { href: "/enterprise/dashboard/settings/sso", label: "SSO" },
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [notifyProofSubmitted, setNotifyProofSubmitted] = useState(true);
  const [notifyPendingReview, setNotifyPendingReview] = useState(true);
  const [notifyMilestoneCompleted, setNotifyMilestoneCompleted] = useState(true);
  const [notifyVerified, setNotifyVerified] = useState(true);
  const [notifyRejected, setNotifyRejected] = useState(true);

  // Preferences — stored in localStorage, no server-side persistence needed
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    setTimezone(localStorage.getItem("ent_timezone") ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
    setDateFormat(localStorage.getItem("ent_dateFormat") ?? "DD/MM/YYYY");
    setLanguage(localStorage.getItem("ent_language") ?? "en");

    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        const u: UserProfile = data.user;
        setProfile(u);
        setName(u.name ?? "");
        setCompanyName(u.companyName ?? "");
        setJobTitle(u.jobTitle ?? "");
        setDepartment(u.department ?? "");
        setNotifyProofSubmitted(u.notifyProofSubmitted);
        setNotifyPendingReview(u.notifyPendingReview);
        setNotifyMilestoneCompleted(u.notifyMilestoneCompleted);
        setNotifyVerified(u.notifyVerified);
        setNotifyRejected(u.notifyRejected);
      })
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Save preferences to localStorage
    localStorage.setItem("ent_timezone", timezone);
    localStorage.setItem("ent_dateFormat", dateFormat);
    localStorage.setItem("ent_language", language);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || null,
          companyName: companyName || null,
          jobTitle: jobTitle || null,
          department: department || null,
          notifyProofSubmitted,
          notifyPendingReview,
          notifyMilestoneCompleted,
          notifyVerified,
          notifyRejected,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Failed to save settings");
      }

      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13.5,
    border: "1px solid var(--ent-border)",
    borderRadius: 8,
    background: "var(--ent-bg)",
    color: "var(--ent-text)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "24px",
    marginBottom: 16,
  };

  const sectionTitle: React.CSSProperties = {
    margin: "0 0 4px",
    fontSize: 14,
    fontWeight: 700,
    color: "var(--ent-text)",
  };

  const sectionSub: React.CSSProperties = {
    margin: "0 0 20px",
    fontSize: 13,
    color: "var(--ent-muted)",
  };

  const label: React.CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--ent-text)",
    marginBottom: 5,
  };

  if (loading) {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 700 }}>
        <div style={{ height: 32, width: 160, background: "var(--ent-border)", borderRadius: 6, marginBottom: 28, opacity: 0.6 }} />
        {[200, 280, 160].map((h, i) => (
          <div key={i} style={{ ...card, height: h, marginBottom: 16, opacity: 0.5 }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:.25}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        {/* Sub-navigation */}
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings";
            return (
              <a
                key={tab.href}
                href={tab.href}
                style={{
                  padding: "8px 16px",
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--ent-accent)" : "var(--ent-muted)",
                  borderBottom: active ? "2px solid var(--ent-accent)" : "2px solid transparent",
                  textDecoration: "none",
                  marginBottom: -1,
                  borderRadius: "4px 4px 0 0",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
        {profile?.email && (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ent-muted)" }}>
            Signed in as <strong style={{ color: "var(--ent-text)" }}>{profile.email}</strong>
          </p>
        )}
      </div>

      <form onSubmit={handleSave}>
        {/* ── Profile card ─────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>Profile</h2>
          <p style={sectionSub}>Your name and organization details visible to auditors and team members.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { lbl: "Full name", val: name, set: setName, ph: "Your name" },
              { lbl: "Company name", val: companyName, set: setCompanyName, ph: "Acme Corp" },
              { lbl: "Job title", val: jobTitle, set: setJobTitle, ph: "e.g. Head of Sustainability" },
              { lbl: "Department", val: department, set: setDepartment, ph: "e.g. Finance & Compliance" },
            ].map((f) => (
              <div key={f.lbl}>
                <label style={label}>{f.lbl}</label>
                <input
                  type="text"
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  placeholder={f.ph}
                  style={input}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── Preferences card ────────────────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>Preferences</h2>
          <p style={sectionSub}>Customize how dates and content are displayed across the platform.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={label}>Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Date format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ ...input, cursor: "pointer" }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Email notifications card ─────────────────────────────── */}
        <div style={card}>
          <h2 style={sectionTitle}>Email Notifications</h2>
          <p style={sectionSub}>Choose which events trigger email notifications to your inbox.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              {
                label: "Milestone completed",
                sub: "When a milestone is fully verified and completed",
                value: notifyMilestoneCompleted,
                set: setNotifyMilestoneCompleted,
              },
              {
                label: "Evidence verified",
                sub: "When submitted evidence is approved by AI",
                value: notifyVerified,
                set: setNotifyVerified,
              },
              {
                label: "Evidence rejected",
                sub: "When submitted evidence does not meet the milestone criteria",
                value: notifyRejected,
                set: setNotifyRejected,
              },
              {
                label: "Proof submitted",
                sub: "When new evidence is uploaded for a milestone",
                value: notifyProofSubmitted,
                set: setNotifyProofSubmitted,
              },
              {
                label: "Pending manual review",
                sub: "When AI results require manual review by your team",
                value: notifyPendingReview,
                set: setNotifyPendingReview,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "13px 14px",
                  borderRadius: 8,
                  background: item.value ? "#F8FAFF" : "transparent",
                  border: `1px solid ${item.value ? "#DBEAFE" : "transparent"}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onClick={() => item.set(!item.value)}
              >
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>{item.sub}</p>
                </div>
                <Toggle checked={item.value} onChange={item.set} />
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 24px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              boxShadow: saving ? "none" : "0 1px 3px rgba(29,78,216,0.25)",
              transition: "background 0.15s, box-shadow 0.15s",
            }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Saving…
              </>
            ) : "Save changes"}
          </button>
          <span style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>Changes are applied immediately.</span>
        </div>
      </form>

      {/* ── Security card (outside form) ─────────────────────────── */}
      <div style={card}>
        <h2 style={sectionTitle}>Security</h2>
        <p style={sectionSub}>Manage your password and two-factor authentication.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            {
              icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ),
              label: "Password",
              sub: "Update your account password",
              href: "/profile#password",
              action: "Change password",
            },
            {
              icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3.75h3M6.75 21h10.5" />
                </svg>
              ),
              label: "Two-factor authentication",
              sub: "Add an extra layer of security with TOTP",
              href: "/profile#2fa",
              action: "Configure 2FA",
            },
            {
              icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              ),
              label: "Active sessions",
              sub: "Review and manage where you're signed in",
              href: "/profile#sessions",
              action: "View sessions",
            },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "14px 0",
                borderBottom: i < arr.length - 1 ? "1px solid var(--ent-border)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: "var(--ent-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ent-muted)",
                  flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>{item.sub}</p>
                </div>
              </div>
              <Link
                href={item.href}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ent-accent)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  padding: "6px 14px",
                  borderRadius: 7,
                  border: "1px solid var(--ent-border)",
                  background: "white",
                }}
              >
                {item.action}
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ── Account card ─────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 0 }}>
        <h2 style={sectionTitle}>Account</h2>
        <p style={sectionSub}>Your account data and export options.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/profile#export"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ent-text)",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 7,
              border: "1px solid var(--ent-border)",
              background: "var(--ent-bg)",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export my data
          </Link>
          <Link
            href="/profile#delete"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: "#DC2626",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 7,
              border: "1px solid #FECACA",
              background: "#FFF5F5",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Delete account
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
