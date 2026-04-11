"use client";

import { useEffect, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  kycTier: number;
  sanctionsStatus: string | null;
  sanctionsCheckedAt: string | null;
  emailVerified: string | null;
  walletAddress: string | null;
  companyName: string | null;
  createdAt: string;
  nameFlagged: boolean;
  _count: { contracts: number; startupContracts: number };
}

const TIER_COLORS: Record<number, string> = {
  0: "#F87171",
  1: "#6EE09A",
  2: "#7DB8F7",
  3: "#C4ADFA",
};

const ROLE_COLORS: Record<string, string> = {
  INVESTOR: "#E8935A",
  STARTUP: "#7DB8F7",
  ADMIN: "#C4ADFA",
};

function TierSelect({ userId, current, apiKey, onUpdated }: {
  userId: string;
  current: number;
  apiKey: string;
  onUpdated: (newTier: number) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const tier = Number(e.target.value);
    setLoading(true);
    try {
      const res = await fetch(`/api/internal/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-internal-key": apiKey },
        body: JSON.stringify({ kycTier: tier }),
      });
      if (res.ok) onUpdated(tier);
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={loading}
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(196,112,75,0.2)",
        borderRadius: 6,
        padding: "2px 6px",
        color: TIER_COLORS[current] ?? "#EDE6DD",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        outline: "none",
        opacity: loading ? 0.5 : 1,
      }}
    >
      {[0, 1, 2, 3].map((t) => (
        <option key={t} value={t} style={{ background: "#1e1a18", color: TIER_COLORS[t] }}>
          Tier {t}
        </option>
      ))}
    </select>
  );
}

function RecheckButton({ userId, apiKey, onUpdated }: {
  userId: string;
  apiKey: string;
  onUpdated: (status: string, tier: number) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/internal/users/${userId}`, {
        method: "POST",
        headers: { "x-internal-key": apiKey },
      });
      if (res.ok) {
        const d = await res.json();
        onUpdated(d.user.sanctionsStatus, d.user.kycTier);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      title="Re-run sanctions screening"
      style={{
        marginLeft: 6,
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 4,
        border: "1px solid rgba(196,112,75,0.3)",
        background: "transparent",
        color: "#A89B8C",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? "…" : "recheck"}
    </button>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const key = sessionStorage.getItem("cascrow_internal_key") ?? "";
    setApiKey(key);
    fetch("/api/internal/users", {
      headers: { "x-internal-key": key },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(true); return; }
        setUsers(d.users);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.companyName ?? "").toLowerCase().includes(q)
    );
  });

  if (loading) return <p style={{ color: "#A89B8C" }}>Loading users…</p>;
  if (error) return <p style={{ color: "#F87171" }}>Failed to load. Check your API key.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: "#EDE6DD", margin: 0 }}>Users</h1>
          <p style={{ fontSize: 12, color: "#A89B8C", margin: "4px 0 0" }}>{users.length} total</p>
        </div>
        <input
          type="text"
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(196,112,75,0.2)",
            borderRadius: 8,
            padding: "8px 14px",
            color: "#EDE6DD",
            fontSize: 13,
            outline: "none",
            width: 260,
          }}
        />
      </div>

      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[0, 1, 2, 3].map((tier) => {
          const count = users.filter((u) => u.kycTier === tier).length;
          return (
            <div key={tier} style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tier {tier}</div>
              <div style={{ fontSize: 24, fontWeight: 300, color: TIER_COLORS[tier] ?? "#EDE6DD", marginTop: 4 }}>{count}</div>
            </div>
          );
        })}
        <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: "#A89B8C", textTransform: "uppercase", letterSpacing: "0.08em" }}>Unverified</div>
          <div style={{ fontSize: 24, fontWeight: 300, color: "#F87171", marginTop: 4 }}>{users.filter((u) => !u.emailVerified).length}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(196,112,75,0.2)" }}>
              {["Email", "Name", "Role", "KYC Tier", "Sanctions", "Contracts", "Joined"].map((h) => (
                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#A89B8C", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr
                key={u.id}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                }}
              >
                <td style={{ padding: "10px 12px", color: u.emailVerified ? "#EDE6DD" : "#A89B8C" }}>
                  <span title={u.id}>{u.email}</span>
                  {!u.emailVerified && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#F87171", padding: "1px 5px", borderRadius: 4, background: "rgba(248,113,113,0.1)" }}>
                      unverified
                    </span>
                  )}
                </td>
                <td style={{ padding: "10px 12px", color: "#A89B8C" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {u.companyName ?? u.name ?? <span style={{ color: "#6B5E52", fontStyle: "italic" }}>—</span>}
                    {u.nameFlagged && (
                      <span title="Name looks like a placeholder" style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(251,191,36,0.15)", color: "#FBBF24", fontWeight: 600 }}>
                        suspicious
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(196,112,75,0.1)", color: ROLE_COLORS[u.role] ?? "#A89B8C" }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <TierSelect
                    userId={u.id}
                    current={u.kycTier}
                    apiKey={apiKey}
                    onUpdated={(newTier) => updateUser(u.id, { kycTier: newTier })}
                  />
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {u.sanctionsStatus ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                        background: u.sanctionsStatus === "CLEAR" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                        color: u.sanctionsStatus === "CLEAR" ? "#6EE09A" : "#F87171",
                      }}>
                        {u.sanctionsStatus}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#6B5E52", fontStyle: "italic" }}>not checked</span>
                    )}
                    <RecheckButton
                      userId={u.id}
                      apiKey={apiKey}
                      onUpdated={(status, tier) => updateUser(u.id, { sanctionsStatus: status, kycTier: tier })}
                    />
                  </div>
                </td>
                <td style={{ padding: "10px 12px", color: "#A89B8C", textAlign: "center" }}>
                  {u._count.contracts + u._count.startupContracts > 0 ? (
                    <span style={{ color: "#EDE6DD" }}>
                      {u._count.contracts + u._count.startupContracts}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "#6B5E52", whiteSpace: "nowrap" }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "24px 12px", textAlign: "center", color: "#6B5E52" }}>
                  No users match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
