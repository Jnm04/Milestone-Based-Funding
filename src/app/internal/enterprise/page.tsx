"use client";

import { useEffect, useState, useCallback } from "react";
import { internalFetch } from "@/lib/internal-client";

const USE_CASE_LABEL: Record<string, string> = {
  CSRD: "CSRD / ESG",
  KPI: "KPI Attestation",
  COMPLIANCE: "Group Compliance",
  OTHER: "Other",
};

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  company: string;
  useCase: string;
  message: string | null;
  preActivated: boolean;
  createdAt: string;
}

interface ActiveUser {
  id: string;
  name: string | null;
  email: string;
  companyName: string | null;
  enterpriseActivatedAt: string | null;
}

export default function EnterpriseAdminPage() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [feedback, setFeedback] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await internalFetch("/api/internal/enterprise");
    if (res.ok) {
      const data = await res.json();
      setWaitlist(data.waitlist);
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function activate(email: string, waitlistId?: string) {
    const key = waitlistId ?? email;
    setActivating(key);
    setFeedback(null);
    try {
      const res = await internalFetch("/api/internal/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, waitlistId }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.pending
          ? `Pre-activated ${email} — enterprise access will be granted automatically when they register.`
          : `Access activated for ${email}`;
        setFeedback({ id: key, ok: true, msg });
        await load();
        setManualEmail("");
      } else {
        setFeedback({ id: key, ok: false, msg: data.error ?? "Failed" });
      }
    } finally {
      setActivating(null);
    }
  }

  const cell = { padding: "12px 16px", fontSize: 13, borderBottom: "1px solid rgba(196,112,75,0.08)", color: "#A89B8C" };
  const header = { ...cell, color: "#EDE6DD", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.08em" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#EDE6DD", margin: "0 0 4px" }}>Enterprise Access</h1>
        <p style={{ color: "#A89B8C", fontSize: 13, margin: 0 }}>Manage waitlist entries and activate enterprise accounts.</p>
      </div>

      {feedback && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: feedback.ok ? "rgba(110,224,154,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${feedback.ok ? "rgba(110,224,154,0.2)" : "rgba(239,68,68,0.2)"}`,
          color: feedback.ok ? "#6ee09a" : "#f87171",
          fontSize: 13,
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Manual activation */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 12, padding: 24 }}>
        <p style={{ color: "#EDE6DD", fontWeight: 600, fontSize: 14, margin: "0 0 12px" }}>Activate by email</p>
        <p style={{ color: "#A89B8C", fontSize: 12, margin: "0 0 16px" }}>
          If the user already has a cascrow account, they&apos;ll get access immediately + activation email.
          If not, their email is pre-activated — enterprise access is granted automatically when they register.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="user@company.com"
            style={{
              flex: 1,
              padding: "9px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(196,112,75,0.2)",
              color: "#EDE6DD",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={() => manualEmail && activate(manualEmail)}
            disabled={!manualEmail || activating === manualEmail}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              background: "#C4704B",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              opacity: !manualEmail ? 0.5 : 1,
            }}
          >
            {activating === manualEmail ? "Activating…" : "Activate"}
          </button>
        </div>
      </div>

      {/* Waitlist */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#EDE6DD", margin: "0 0 14px" }}>
          Waitlist ({waitlist.length})
        </h2>
        {loading ? (
          <p style={{ color: "#A89B8C", fontSize: 13 }}>Loading…</p>
        ) : waitlist.length === 0 ? (
          <p style={{ color: "#A89B8C", fontSize: 13 }}>No pending requests.</p>
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(196,112,75,0.15)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(196,112,75,0.06)" }}>
                <tr>
                  {["Name", "Email", "Company", "Use Case", "Submitted", "Message", "Action"].map((h) => (
                    <th key={h} style={{ ...header, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waitlist.map((entry) => (
                  <tr key={entry.id} style={{ background: "rgba(255,255,255,0.01)" }}>
                    <td style={cell}>{entry.name}</td>
                    <td style={cell}>{entry.email}</td>
                    <td style={{ ...cell, fontWeight: 500, color: "#EDE6DD" }}>{entry.company}</td>
                    <td style={cell}>
                      <span style={{ background: "rgba(196,112,75,0.12)", color: "#C4704B", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                        {USE_CASE_LABEL[entry.useCase] ?? entry.useCase}
                      </span>
                    </td>
                    <td style={cell}>{new Date(entry.createdAt).toLocaleDateString()}</td>
                    <td style={{ ...cell, maxWidth: 240 }}>
                      {entry.message ? (
                        <span title={entry.message} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 200 }}>
                          {entry.message}
                        </span>
                      ) : <span style={{ color: "#5a5047" }}>—</span>}
                    </td>
                    <td style={cell}>
                      {entry.preActivated ? (
                        <span style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "rgba(59,130,246,0.12)",
                          color: "#60a5fa",
                          border: "1px solid rgba(59,130,246,0.2)",
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          Pre-activated
                        </span>
                      ) : (
                        <button
                          onClick={() => activate(entry.email, entry.id)}
                          disabled={activating === entry.id}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            background: activating === entry.id ? "rgba(110,224,154,0.1)" : "rgba(110,224,154,0.15)",
                            color: "#6ee09a",
                            border: "1px solid rgba(110,224,154,0.2)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {activating === entry.id ? "…" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active enterprise users */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: "#EDE6DD", margin: "0 0 14px" }}>
          Active Enterprise Accounts ({users.length})
        </h2>
        {users.length === 0 ? (
          <p style={{ color: "#A89B8C", fontSize: 13 }}>No enterprise accounts yet.</p>
        ) : (
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(196,112,75,0.15)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "rgba(196,112,75,0.06)" }}>
                <tr>
                  {["Name", "Email", "Company", "Activated"].map((h) => (
                    <th key={h} style={{ ...header, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ background: "rgba(255,255,255,0.01)" }}>
                    <td style={{ ...cell, color: "#EDE6DD", fontWeight: 500 }}>{u.name ?? "—"}</td>
                    <td style={cell}>{u.email}</td>
                    <td style={cell}>{u.companyName ?? "—"}</td>
                    <td style={cell}>{u.enterpriseActivatedAt ? new Date(u.enterpriseActivatedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
