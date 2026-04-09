"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "cascrow_internal_key";

function useInternalAuth() {
  const [key, setKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    setKey(stored);
    setChecked(true);
  }, []);

  const login = (k: string) => {
    sessionStorage.setItem(STORAGE_KEY, k);
    setKey(k);
  };

  return { key, checked, login };
}

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  const { key, checked, login } = useInternalAuth();
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (!checked) return null;

  if (!key) {
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (input.length > 0) login(input);
                else setError(true);
              }
            }}
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
          <button
            onClick={() => { if (input.length > 0) login(input); else setError(true); }}
            style={{ padding: "10px 0", borderRadius: 8, background: "#C4704B", color: "#fff", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}
          >
            Enter
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
          { href: "/internal/review", label: "Review Queue" },
          { href: "/internal/sandbox", label: "Sandbox" },
          { href: "/internal/generate", label: "Generate" },
          { href: "/internal/dataset", label: "Dataset" },
          { href: "/internal/graph", label: "Brain Map" },
          { href: "/internal/usage", label: "Usage" },
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
            onClick={() => { sessionStorage.removeItem(STORAGE_KEY); window.location.reload(); }}
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
