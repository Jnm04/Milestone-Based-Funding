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

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  fontSize: 13.5,
  fontWeight: active ? 600 : 500,
  color: active ? "var(--ent-accent)" : "var(--ent-muted)",
  borderBottom: active ? "2px solid var(--ent-accent)" : "2px solid transparent",
  textDecoration: "none",
  marginBottom: -1,
});

const cardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 20,
};

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

  return (
    <div style={{ padding: "32px 36px", maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--ent-border)", marginBottom: 28 }}>
          {[
            { href: "/enterprise/dashboard/settings", label: "Profile" },
            { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
            { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
            { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
          ].map((tab) => (
            <a key={tab.href} href={tab.href} style={tabStyle(tab.href === "/enterprise/dashboard/settings/team")}>
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* Invite form */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>Invite a team member</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ent-muted)" }}>
          Team members receive read-only access to your attestation workspace. An invitation email will be sent.
        </p>
        <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            style={{ ...inputStyle, flex: "1 1 220px" }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{ ...inputStyle, width: "auto", flex: "0 0 auto" }}
          >
            <option value="VIEWER">Viewer</option>
            <option value="EDITOR">Editor</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            style={{
              background: inviting ? "#93C5FD" : "var(--ent-accent)",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "9px 18px",
              fontSize: 13,
              fontWeight: 600,
              cursor: inviting ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
      </div>

      {/* Member list */}
      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>
          Team ({members.length})
        </h2>
        {loading ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>Loading…</p>
        ) : members.length === 0 ? (
          <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>No team members yet. Invite a colleague above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {members.map((m, i) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--ent-border)",
                }}
              >
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 13.5, fontWeight: 600, color: "var(--ent-text)" }}>
                    {m.member?.name ?? m.name ?? m.email}
                  </p>
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>{m.email}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 99,
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
                      border: "1px solid #FCA5A5",
                      color: "#DC2626",
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ fontSize: 12.5, color: "var(--ent-muted)" }}>
        Team members can view all attestation data in your workspace.{" "}
        <Link href="/security" style={{ color: "var(--ent-accent)" }}>Learn about access controls →</Link>
      </p>
    </div>
  );
}
