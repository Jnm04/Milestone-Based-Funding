"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [notifyProofSubmitted, setNotifyProofSubmitted] = useState(true);
  const [notifyPendingReview, setNotifyPendingReview] = useState(true);
  const [notifyMilestoneCompleted, setNotifyMilestoneCompleted] = useState(true);
  const [notifyVerified, setNotifyVerified] = useState(true);
  const [notifyRejected, setNotifyRejected] = useState(true);

  useEffect(() => {
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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13.5,
    border: "1px solid var(--ent-border)",
    borderRadius: 7,
    background: "white",
    color: "var(--ent-text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--ent-text)",
    marginBottom: 6,
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "24px",
    marginBottom: 20,
  };

  if (loading) {
    return (
      <div style={{ padding: "32px 36px", maxWidth: 680 }}>
        <div style={{ height: 32, width: 200, background: "var(--ent-border)", borderRadius: 6, marginBottom: 32, animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ ...cardStyle, height: 200, animation: "pulse 1.5s ease-in-out infinite" }} />
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          {profile?.email}
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* Profile info */}
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Profile</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Company name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Job title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Head of Sustainability"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Finance & Compliance"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Notification preferences */}
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
            Email Notifications
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
            Choose which events trigger email notifications.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                sub: "When AI results require manual review",
                value: notifyPendingReview,
                set: setNotifyPendingReview,
              },
            ].map((item) => (
              <label
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--ent-border)",
                  background: item.value ? "#F8FAFF" : "white",
                }}
              >
                <input
                  type="checkbox"
                  checked={item.value}
                  onChange={(e) => item.set(e.target.checked)}
                  style={{ marginTop: 2, accentColor: "var(--ent-accent)", width: 15, height: 15, cursor: "pointer" }}
                />
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>{item.sub}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {saving ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
