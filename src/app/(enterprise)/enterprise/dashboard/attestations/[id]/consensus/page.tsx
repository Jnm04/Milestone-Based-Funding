"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";

const ROLE_OPTS = ["AUDITOR", "REGULATOR", "INVESTOR", "COMMITTEE"];
const ROLE_LABEL: Record<string, string> = {
  AUDITOR: "Auditor", REGULATOR: "Regulator", INVESTOR: "Investor", COMMITTEE: "Committee",
};

interface Vote {
  id: string;
  partyEmail: string;
  partyRole: string;
  vote: string | null;
  reasoning: string | null;
  votedAt: string | null;
  tokenUsed: boolean;
  tokenExpiry: string;
  xrplTxHash: string | null;
}

interface MilestoneConsensus {
  id: string;
  title: string;
  consensusEnabled: boolean;
  consensusThreshold: number | null;
  consensusStatus: string | null;
  consensusDeadline: string | null;
}

interface MilestoneRow {
  id: string;
  title: string;
  consensus: MilestoneConsensus | null;
  votes: Vote[];
}

const IS_TESTNET = process.env.NEXT_PUBLIC_XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  AWAITING_VOTES: { label: "Awaiting votes", color: "#1D4ED8", bg: "#EFF6FF" },
  REACHED:        { label: "Consensus reached", color: "#16A34A", bg: "#DCFCE7" },
  FAILED:         { label: "Consensus failed", color: "#DC2626", bg: "#FEE2E2" },
  TIMED_OUT:      { label: "Timed out", color: "#9CA3AF", bg: "#F3F4F6" },
};

export default function ConsensusPage() {
  const params = useParams();
  const contractId = params.id as string;

  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState<string | null>(null); // milestoneId

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AUDITOR");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [threshold, setThreshold] = useState("2");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/enterprise/attestations/${contractId}`);
      const data = await res.json() as { contract?: { milestones?: { id: string; title: string }[] } };
      const rawMilestones = data.contract?.milestones ?? [];

      const rows = await Promise.all(
        rawMilestones.map(async (m) => {
          const cRes = await fetch(`/api/enterprise/consensus/${m.id}`);
          if (!cRes.ok) return { id: m.id, title: m.title, consensus: null, votes: [] };
          const cData = await cRes.json() as { milestone: MilestoneConsensus; votes: Vote[] };
          return { id: m.id, title: m.title, consensus: cData.milestone, votes: cData.votes };
        })
      );
      setMilestones(rows);
    } catch {
      toast.error("Failed to load consensus data");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { void load(); }, [load]);

  async function handleInvite() {
    if (!inviteOpen || !email || !deadline) return;
    setInviting(true);
    try {
      const res = await fetch("/api/enterprise/consensus/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneId: inviteOpen,
          partyEmail: email,
          partyRole: role,
          consensusDeadline: new Date(deadline).toISOString(),
          consensusThreshold: parseInt(threshold, 10),
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send invite");
      toast.success(`Invite sent to ${email}`);
      setInviteOpen(null);
      setEmail("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid var(--ent-border)", fontSize: 13, outline: "none",
    color: "var(--ent-text)", background: "white",
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    border: "1px solid var(--ent-border)",
    borderRadius: 12,
    padding: "20px 24px",
    marginBottom: 14,
  };

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <a href={`/enterprise/dashboard/attestations/${contractId}`} style={{ fontSize: 13, color: "var(--ent-muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
          ← Back to Goal Set
        </a>
        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700, color: "var(--ent-text)", letterSpacing: "-0.02em" }}>
          Consensus Voting
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ent-muted)" }}>
          Invite external parties (auditors, regulators, investors) to independently verify milestones
        </p>
      </div>

      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "14px 20px", marginBottom: 24, fontSize: 13, color: "#1E40AF", lineHeight: 1.55 }}>
        Each invited party receives a unique email link. Their vote is cast on a tamper-proof page and anchored on the XRP Ledger. Consensus is reached when the required number of YES votes is collected before the deadline.
      </div>

      {loading ? (
        <p style={{ color: "var(--ent-muted)", fontSize: 14 }}>Loading…</p>
      ) : milestones.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: 0, color: "var(--ent-muted)", fontSize: 14 }}>No milestones in this goal set.</p>
        </div>
      ) : (
        milestones.map((m) => {
          const status = m.consensus?.consensusStatus;
          const statusCfg = status ? (STATUS_CFG[status] ?? null) : null;
          const yesVotes = m.votes.filter((v) => v.vote === "YES").length;
          const totalVoted = m.votes.filter((v) => v.tokenUsed).length;
          const threshold_ = m.consensus?.consensusThreshold ?? 2;
          const deadline_ = m.consensus?.consensusDeadline
            ? new Date(m.consensus.consensusDeadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : null;

          return (
            <div key={m.id} style={cardStyle}>
              {/* Milestone header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ent-text)" }}>{m.title}</p>
                  {statusCfg && (
                    <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 20, color: statusCfg.color, background: statusCfg.bg, display: "inline-block", marginTop: 4 }}>
                      {statusCfg.label}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setInviteOpen(m.id)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                    border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-text)",
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Invite Voter
                </button>
              </div>

              {/* Consensus progress */}
              {m.votes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (yesVotes / threshold_) * 100)}%`, background: "#16A34A", borderRadius: 6, transition: "width .3s" }} />
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ent-muted)", flexShrink: 0 }}>
                      {yesVotes} / {threshold_} YES required
                    </span>
                  </div>
                  {deadline_ && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--ent-muted)" }}>Deadline: {deadline_}</p>
                  )}
                </div>
              )}

              {/* Votes table */}
              {m.votes.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Email", "Role", "Status", "Vote", "On-chain"].map((h) => (
                        <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ent-muted)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--ent-border)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {m.votes.map((v, i) => {
                      const expired = new Date(v.tokenExpiry) < new Date();
                      const voteColor = v.vote === "YES" ? "#16A34A" : v.vote === "NO" ? "#DC2626" : v.vote === "ABSTAIN" ? "#D97706" : "var(--ent-muted)";
                      const statusLabel = v.tokenUsed ? "Voted" : expired ? "Expired" : "Invited";
                      const statusColor = v.tokenUsed ? "#16A34A" : expired ? "#DC2626" : "#1D4ED8";

                      return (
                        <tr key={v.id} style={{ borderBottom: i < m.votes.length - 1 ? "1px solid var(--ent-border)" : "none" }}>
                          <td style={{ padding: "10px 10px", color: "var(--ent-text)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200, whiteSpace: "nowrap" }}>{v.partyEmail}</td>
                          <td style={{ padding: "10px 10px", color: "var(--ent-muted)" }}>{ROLE_LABEL[v.partyRole] ?? v.partyRole}</td>
                          <td style={{ padding: "10px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                            {v.votedAt && <div style={{ fontSize: 10.5, color: "var(--ent-muted)" }}>{new Date(v.votedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>}
                          </td>
                          <td style={{ padding: "10px 10px", fontWeight: 700, color: voteColor }}>
                            {v.vote ?? "—"}
                          </td>
                          <td style={{ padding: "10px 10px" }}>
                            {v.xrplTxHash ? (
                              <a href={`${XRPL_EXPLORER}/transactions/${v.xrplTxHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--ent-accent)", textDecoration: "none" }}>
                                {v.xrplTxHash.slice(0, 8)}…
                              </a>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "var(--ent-muted)", fontStyle: "italic" }}>
                  No voters invited yet. Click "Invite Voter" to start.
                </p>
              )}
            </div>
          );
        })
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setInviteOpen(null)}
        >
          <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, color: "var(--ent-text)" }}>Invite Voter</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="auditor@firm.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle }}>
                {ROLE_OPTS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Vote deadline</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ ...inputStyle }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ent-muted)", marginBottom: 4 }}>Votes required</label>
                <input type="number" min={1} max={10} value={threshold} onChange={(e) => setThreshold(e.target.value)} style={{ ...inputStyle }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setInviteOpen(null)} style={{ padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "1px solid var(--ent-border)", background: "white", color: "var(--ent-text)", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={inviting || !email}
                onClick={() => void handleInvite()}
                style={{ padding: "8px 20px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", background: !email ? "#E5E7EB" : "var(--ent-accent)", color: !email ? "#9CA3AF" : "white", cursor: (!email || inviting) ? "not-allowed" : "pointer" }}
              >
                {inviting ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
