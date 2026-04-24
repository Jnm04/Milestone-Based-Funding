"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  acceptedAt: string | null;
  createdAt: string;
  member: { name: string | null } | null;
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
  { href: "/enterprise/dashboard/settings/sso", label: "SSO" },
];

const ROLE_INFO: Record<string, { label: string; desc: string }> = {
  VIEWER: { label: "Viewer", desc: "Can view all attestations and reports, cannot make changes" },
  EDITOR: { label: "Editor", desc: "Can create and edit goal sets, submit evidence, and run attestations" },
};

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 16,
};

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

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/enterprise/team");
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch {
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      const res = await fetch("/api/enterprise/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed");
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(id: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from your team?`)) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/enterprise/team?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Remove failed");
      toast.success("Member removed");
      setMembers((m) => m.filter((x) => x.id !== id));
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemoving(null);
    }
  }

  const pendingCount = members.filter((m) => !m.acceptedAt).length;
  const activeCount = members.filter((m) => m.acceptedAt).length;

  return (
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/team";
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
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* Team stats row */}
      {members.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total members", value: members.length },
            { label: "Active", value: activeCount, color: "#059669", bg: "#ECFDF5" },
            { label: "Pending invite", value: pendingCount, color: "#D97706", bg: "#FFFBEB" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: 10,
                background: stat.bg ?? "white",
                border: "1px solid var(--ent-border)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: stat.color ?? "var(--ent-text)", letterSpacing: "-0.03em" }}>
                {stat.value}
              </span>
              <span style={{ fontSize: 12, color: stat.color ?? "var(--ent-muted)", fontWeight: 500 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <div style={card}>
        <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          Invite a team member
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          An invitation email will be sent with a link to join your workspace.
        </p>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              style={input}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
            />
          </div>
          <div style={{ flex: "0 0 auto" }}>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ ...input, width: "auto", minWidth: 120, cursor: "pointer" }}
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviting}
            style={{
              background: inviting ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "9px 20px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: inviting ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              height: 40,
              boxShadow: inviting ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
            }}
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>

        {/* Role descriptions */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {Object.entries(ROLE_INFO).map(([key, info]) => (
            <div
              key={key}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--ent-bg)",
                border: "1px solid var(--ent-border)",
              }}
            >
              <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 700, color: "var(--ent-text)" }}>{info.label}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{info.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Member list */}
      <div style={card}>
        <h2 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>
          Team ({members.length})
        </h2>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ height: 52, borderRadius: 8, background: "var(--ent-bg)", opacity: 0.6 }} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px",
              color: "var(--ent-accent)",
            }}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--ent-text)" }}>No team members yet</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)" }}>Invite a colleague using the form above.</p>
          </div>
        ) : (
          <div>
            {members.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "13px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--ent-border)",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: m.acceptedAt ? "#EFF6FF" : "#F8FAFC",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                    color: m.acceptedAt ? "var(--ent-accent)" : "var(--ent-muted)",
                    flexShrink: 0,
                  }}>
                    {(m.member?.name ?? m.name ?? m.email)[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.member?.name ?? m.name ?? m.email}
                    </p>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>{m.email}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11.5, fontWeight: 600,
                    padding: "3px 9px", borderRadius: 99,
                    background: m.acceptedAt ? "#DCFCE7" : "#FEF9C3",
                    color: m.acceptedAt ? "#15803D" : "#92400E",
                  }}>
                    {m.acceptedAt ? m.role : "Pending"}
                  </span>
                  <button
                    onClick={() => handleRemove(m.id, m.email)}
                    disabled={removing === m.id}
                    style={{
                      background: "none",
                      border: "1px solid #FECACA",
                      color: removing === m.id ? "#FCA5A5" : "#DC2626",
                      borderRadius: 7,
                      padding: "5px 12px",
                      fontSize: 12.5,
                      cursor: removing === m.id ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      transition: "all 0.15s",
                    }}
                  >
                    {removing === m.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>
        Team members can view attestation data in your workspace.{" "}
        <Link href="/security" style={{ color: "var(--ent-accent)", textDecoration: "none" }}>
          Learn about access controls →
        </Link>
      </p>

      <style>{`
        input:focus, select:focus { border-color: var(--ent-accent) !important; box-shadow: 0 0 0 3px rgba(29,78,216,0.08); }
      `}</style>
    </div>
  );
}
