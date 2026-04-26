"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Integration {
  id: string;
  type: string;
  channelId?: string | null;
  channelName?: string | null;
  events: string[];
  createdAt: string;
}

const TABS = [
  { href: "/enterprise/dashboard/settings", label: "Profile" },
  { href: "/enterprise/dashboard/settings/team", label: "Team Members" },
  { href: "/enterprise/dashboard/settings/api-keys", label: "API Keys" },
  { href: "/enterprise/dashboard/settings/webhooks", label: "Webhooks" },
  { href: "/enterprise/dashboard/settings/integrations", label: "Integrations" },
  { href: "/enterprise/dashboard/settings/sso", label: "SSO" },
  { href: "/enterprise/dashboard/settings/audit-log", label: "Audit Log" },
];

const ALL_EVENTS: { id: string; label: string; desc: string }[] = [
  { id: "attestation.completed", label: "Attestation Completed", desc: "When an AI verification run finishes with a VERIFIED result" },
  { id: "attestation.failed", label: "Attestation Failed", desc: "When a verification run returns NOT MET" },
  { id: "deadline.approaching", label: "Deadline Approaching", desc: "When a milestone deadline is within 7 days" },
  { id: "connector.error", label: "Connector Error", desc: "When a data connector fails to fetch evidence" },
];

const card: React.CSSProperties = {
  background: "white",
  border: "1px solid var(--ent-border)",
  borderRadius: 12,
  padding: "24px",
  marginBottom: 16,
};

export default function IntegrationsPage() {
  const [slack, setSlack] = useState<Integration | null>(null);
  const [teams, setTeams] = useState<Integration | null>(null);
  const [loadingSlack, setLoadingSlack] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Teams form
  const [teamsUrl, setTeamsUrl] = useState("");
  const [teamsChannel, setTeamsChannel] = useState("");
  const [teamsEvents, setTeamsEvents] = useState<string[]>(["attestation.completed", "attestation.failed", "deadline.approaching"]);
  const [savingTeams, setSavingTeams] = useState(false);

  // Disconnecting
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  async function loadSlack() {
    try {
      const res = await fetch("/api/enterprise/integrations/slack");
      const data = await res.json();
      setSlack(data.integration ?? null);
    } catch {
      /* silent */
    } finally {
      setLoadingSlack(false);
    }
  }

  async function loadTeams() {
    try {
      const res = await fetch("/api/enterprise/integrations/teams");
      const data = await res.json();
      setTeams(data.integration ?? null);
      if (data.integration) {
        setTeamsChannel(data.integration.channelName ?? "");
        setTeamsEvents(Array.isArray(data.integration.events) ? data.integration.events : []);
      }
    } catch {
      /* silent */
    } finally {
      setLoadingTeams(false);
    }
  }

  useEffect(() => {
    loadSlack();
    loadTeams();
  }, []);

  async function handleDisconnect(type: string) {
    if (!confirm(`Disconnect ${type === "slack" ? "Slack" : "Microsoft Teams"}? Notifications will stop immediately.`)) return;
    setDisconnecting(type);
    try {
      const res = await fetch(`/api/enterprise/integrations/${type}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed");
      if (type === "slack") setSlack(null);
      else setTeams(null);
      toast.success(`${type === "slack" ? "Slack" : "Teams"} disconnected`);
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleSaveTeams(e: React.FormEvent) {
    e.preventDefault();
    if (!teamsUrl.trim()) return;
    setSavingTeams(true);
    try {
      const res = await fetch("/api/enterprise/integrations/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: teamsUrl.trim(), channelName: teamsChannel.trim() || "Teams", events: teamsEvents }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setTeams(data.integration);
      setTeamsUrl("");
      toast.success("Microsoft Teams connected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingTeams(false);
    }
  }

  function toggleTeamsEvent(id: string) {
    setTeamsEvents((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  }

  async function handleUpdateSlackEvents(events: string[]) {
    try {
      const res = await fetch("/api/enterprise/integrations/slack", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) throw new Error("Update failed");
      setSlack((prev) => prev ? { ...prev, events } : prev);
      toast.success("Notification preferences updated");
    } catch {
      toast.error("Failed to update preferences");
    }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Settings
        </h1>
        <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--ent-border)", marginBottom: 4 }}>
          {TABS.map((tab) => {
            const active = tab.href === "/enterprise/dashboard/settings/integrations";
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

      {/* Slack */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#4A154B",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Slack</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>
                {loadingSlack ? "Loading…" : slack ? `Connected to #${slack.channelName ?? "channel"}` : "Not connected"}
              </p>
            </div>
          </div>
          {!loadingSlack && (
            slack ? (
              <button
                onClick={() => handleDisconnect("slack")}
                disabled={disconnecting === "slack"}
                style={{
                  background: "none", border: "1px solid #FECACA",
                  color: disconnecting === "slack" ? "#FCA5A5" : "#DC2626",
                  borderRadius: 7, padding: "6px 14px", fontSize: 12.5, fontWeight: 600,
                  cursor: disconnecting === "slack" ? "not-allowed" : "pointer",
                  flexShrink: 0, transition: "all 0.15s",
                }}
              >
                {disconnecting === "slack" ? "Disconnecting…" : "Disconnect"}
              </button>
            ) : (
              <a
                href="/api/enterprise/integrations/slack/connect"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: "#4A154B", color: "white", textDecoration: "none",
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                  <path d="M12 4.5v15m7.5-7.5h-15" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
                Connect Slack
              </a>
            )
          )}
        </div>

        {slack && (
          <div>
            <div style={{ height: 1, background: "var(--ent-border)", margin: "0 0 20px" }} />
            <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)" }}>
              Notify me when…
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALL_EVENTS.map((ev) => {
                const checked = slack.events.includes(ev.id);
                return (
                  <label key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked ? slack.events.filter((e) => e !== ev.id) : [...slack.events, ev.id];
                        handleUpdateSlackEvents(next);
                      }}
                      style={{ marginTop: 2, accentColor: "var(--ent-accent)", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <div>
                      <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "var(--ent-text)" }}>{ev.label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{ev.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!slack && !loadingSlack && (
          <div style={{
            background: "var(--ent-bg)", borderRadius: 8, padding: "12px 14px",
            fontSize: 12.5, color: "var(--ent-muted)", lineHeight: 1.5,
          }}>
            Connect Slack to receive real-time attestation notifications in any channel. Requires Slack OAuth.
          </div>
        )}
      </div>

      {/* Microsoft Teams */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "#464EB8",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20.625 8.025H13.5V15h7.125A.375.375 0 0021 14.625V8.4a.375.375 0 00-.375-.375z" fill="white"/>
                <path d="M13.5 5.25a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z" fill="white" opacity=".7"/>
                <path d="M17.25 4.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="white"/>
                <path d="M2.25 8.25A.75.75 0 013 7.5h8.25a.75.75 0 01.75.75v6.75a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75V8.25z" fill="white" opacity=".8"/>
              </svg>
            </div>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "var(--ent-text)" }}>Microsoft Teams</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ent-muted)" }}>
                {loadingTeams ? "Loading…" : teams ? `Connected to ${teams.channelName ?? "Teams"}` : "Not connected"}
              </p>
            </div>
          </div>
          {teams && !loadingTeams && (
            <button
              onClick={() => handleDisconnect("teams")}
              disabled={disconnecting === "teams"}
              style={{
                background: "none", border: "1px solid #FECACA",
                color: disconnecting === "teams" ? "#FCA5A5" : "#DC2626",
                borderRadius: 7, padding: "6px 14px", fontSize: 12.5, fontWeight: 600,
                cursor: disconnecting === "teams" ? "not-allowed" : "pointer",
                flexShrink: 0, transition: "all 0.15s",
              }}
            >
              {disconnecting === "teams" ? "Disconnecting…" : "Disconnect"}
            </button>
          )}
        </div>

        {!teams && !loadingTeams && (
          <form onSubmit={handleSaveTeams}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                  Incoming Webhook URL <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="url"
                  value={teamsUrl}
                  onChange={(e) => setTeamsUrl(e.target.value)}
                  placeholder="https://companyname.webhook.office.com/webhookb2/..."
                  required
                  style={{
                    width: "100%", padding: "9px 12px", fontSize: 13.5,
                    border: "1px solid var(--ent-border)", borderRadius: 8,
                    background: "var(--ent-bg)", color: "var(--ent-text)",
                    outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                />
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
                  Create an Incoming Webhook connector in your Teams channel settings, then paste the URL here.
                </p>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)", marginBottom: 5 }}>
                  Channel name (optional)
                </label>
                <input
                  type="text"
                  value={teamsChannel}
                  onChange={(e) => setTeamsChannel(e.target.value)}
                  placeholder="e.g. #attestations"
                  maxLength={80}
                  style={{
                    width: "100%", padding: "9px 12px", fontSize: 13.5,
                    border: "1px solid var(--ent-border)", borderRadius: 8,
                    background: "var(--ent-bg)", color: "var(--ent-text)",
                    outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ent-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ent-border)")}
                />
              </div>
              <div>
                <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)" }}>
                  Notify me when…
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ALL_EVENTS.map((ev) => {
                    const checked = teamsEvents.includes(ev.id);
                    return (
                      <label key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeamsEvent(ev.id)}
                          style={{ marginTop: 2, accentColor: "var(--ent-accent)", width: 14, height: 14, flexShrink: 0 }}
                        />
                        <div>
                          <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "var(--ent-text)" }}>{ev.label}</p>
                          <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{ev.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={savingTeams}
                  style={{
                    background: savingTeams ? "#93C5FD" : "var(--ent-accent)",
                    color: "white", border: "none", borderRadius: 8,
                    padding: "9px 22px", fontSize: 13.5, fontWeight: 600,
                    cursor: savingTeams ? "not-allowed" : "pointer",
                    boxShadow: savingTeams ? "none" : "0 1px 3px rgba(29,78,216,0.2)",
                  }}
                >
                  {savingTeams ? "Connecting…" : "Connect Teams"}
                </button>
              </div>
            </div>
          </form>
        )}

        {teams && !loadingTeams && (
          <div>
            <div style={{ height: 1, background: "var(--ent-border)", margin: "0 0 20px" }} />
            <p style={{ margin: "0 0 12px", fontSize: 12.5, fontWeight: 600, color: "var(--ent-text)" }}>
              Notify me when…
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ALL_EVENTS.map((ev) => {
                const checked = teams.events.includes(ev.id);
                return (
                  <label key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={async () => {
                        const next = checked ? teams.events.filter((e) => e !== ev.id) : [...teams.events, ev.id];
                        try {
                          const res = await fetch("/api/enterprise/integrations/teams", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ events: next }),
                          });
                          if (!res.ok) throw new Error();
                          setTeams((prev) => prev ? { ...prev, events: next } : prev);
                          toast.success("Notification preferences updated");
                        } catch {
                          toast.error("Failed to update preferences");
                        }
                      }}
                      style={{ marginTop: 2, accentColor: "var(--ent-accent)", width: 14, height: 14, flexShrink: 0 }}
                    />
                    <div>
                      <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "var(--ent-text)" }}>{ev.label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>{ev.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--ent-muted)" }}>
              Connected {new Date(teams.createdAt).toLocaleDateString("en-GB")}
            </p>
          </div>
        )}
      </div>

      <style>{`
        input[type="url"]:focus, input[type="text"]:focus {
          border-color: var(--ent-accent) !important;
          box-shadow: 0 0 0 3px rgba(29,78,216,0.08);
        }
      `}</style>
    </div>
  );
}
