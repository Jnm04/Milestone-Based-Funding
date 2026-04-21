"use client";

import { useState, useEffect } from "react";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if the HTTP-only session cookie is valid on mount.
  useEffect(() => {
    fetch("/api/internal/auth", { credentials: "same-origin" })
      .then((r) => setAuthenticated(r.ok))
      .catch(() => setAuthenticated(false));
  }, []);

  const login = async () => {
    if (!input.trim()) { setError(true); return; }
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/internal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: input }),
        credentials: "same-origin",
      });
      if (res.ok) {
        setAuthenticated(true);
      } else {
        setError(true);
        setInput("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/internal/auth", { method: "DELETE", credentials: "same-origin" });
    setAuthenticated(false);
    setInput("");
  };

  // Still checking cookie
  if (authenticated === null) return null;

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", background: "#171311", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 360, display: "flex", flexDirection: "column", gap: 16, padding: 32, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.2)", borderRadius: 16 }}>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#C4704B", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Cascrow Internal
          </div>
          <p style={{ color: "#A89B8C", fontSize: 13 }}>Enter the internal access key to continue.</p>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") login(); }}
            placeholder="Internal key…"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${error ? "#ef4444" : "rgba(196,112,75,0.2)"}`,
              borderRadius: 8,
              padding: "10px 14px",
              color: "#EDE6DD",
              fontSize: 14,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          {error && (
            <p style={{ color: "#ef4444", fontSize: 12, margin: 0 }}>Invalid key — try again.</p>
          )}
          <button
            onClick={login}
            disabled={loading}
            style={{ padding: "10px 0", borderRadius: 8, background: loading ? "#7a4530" : "#C4704B", color: "#fff", border: "none", cursor: loading ? "default" : "pointer", fontSize: 14, fontWeight: 500 }}
          >
            {loading ? "Verifying…" : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#171311", color: "#EDE6DD" }}>
      {/* Internal nav */}
      <nav style={{ borderBottom: "1px solid rgba(196,112,75,0.15)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 24, background: "rgba(23,19,17,0.95)" }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#C4704B", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          ⚙ Cascrow Internal
        </span>
        {[
          { href: "/internal", label: "Dashboard" },
          { href: "/internal/users", label: "Users" },
          { href: "/internal/review", label: "Review Queue" },
          { href: "/internal/sandbox", label: "Sandbox" },
          { href: "/internal/generate", label: "Generate" },
          { href: "/internal/dataset", label: "Dataset" },
          { href: "/internal/graph", label: "Brain Map" },
          { href: "/internal/usage", label: "Usage" },
          { href: "/internal/errors", label: "Errors" },
          { href: "/internal/enterprise", label: "Enterprise" },
        ].map(({ href, label }) => (
          <a key={href} href={href} style={{ color: "#A89B8C", fontSize: 13, textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#EDE6DD")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#A89B8C")}
          >
            {label}
          </a>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <button
            onClick={logout}
            style={{ fontSize: 12, color: "#A89B8C", background: "none", border: "none", cursor: "pointer" }}
          >
            Log out
          </button>
        </div>
      </nav>
      <div style={{ padding: "32px 24px", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}
