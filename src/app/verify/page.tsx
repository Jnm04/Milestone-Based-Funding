"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ChecklistItem {
  id: number;
  title: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#6b7280",
};

export default function VerifyPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<"pr" | "code">("pr");
  const [taskDescription, setTaskDescription] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [codeText, setCodeText] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistSeverity, setNewChecklistSeverity] = useState<ChecklistItem["severity"]>("HIGH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresAccount, setRequiresAccount] = useState(false);

  function addChecklistItem() {
    if (!newChecklistTitle.trim()) return;
    setChecklistItems((prev) => [
      ...prev,
      { id: prev.length + 1, title: newChecklistTitle.trim(), severity: newChecklistSeverity },
    ]);
    setNewChecklistTitle("");
  }

  function removeChecklistItem(id: number) {
    setChecklistItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRequiresAccount(false);

    if (!taskDescription.trim()) {
      setError("Please describe what the AI was supposed to do.");
      return;
    }
    if (tab === "pr" && !prUrl.trim()) {
      setError("Please enter a GitHub PR URL.");
      return;
    }
    if (tab === "code" && !codeText.trim()) {
      setError("Please paste the code to verify.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { taskDescription };
      if (tab === "pr" && prUrl.trim()) body.prUrl = prUrl.trim();
      if (codeText.trim()) body.codeText = codeText.trim();
      if (checklistItems.length > 0) body.checklistItems = checklistItems;

      const res = await fetch("/api/verify/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.requiresAccount) {
          setRequiresAccount(true);
          setError(data.error);
          return;
        }
        setError(data.error ?? "Verification failed. Please try again.");
        return;
      }

      router.push(`/verify/result/${data.publicHash}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#171311",
        color: "#EDE6DD",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(196,112,75,0.2)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ color: "#C4704B", fontWeight: 700, fontSize: 20 }}>cascrow</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {session ? (
            <Link
              href="/dashboard/investor"
              style={{ color: "#A89B8C", fontSize: 14, textDecoration: "none" }}
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{ color: "#A89B8C", fontSize: 14, textDecoration: "none" }}
              >
                Sign in
              </Link>
              <Link
                href="/register"
                style={{
                  background: "#C4704B",
                  color: "#EDE6DD",
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 14,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(196,112,75,0.15)",
              border: "1px solid rgba(196,112,75,0.3)",
              borderRadius: 20,
              padding: "4px 14px",
              marginBottom: 16,
            }}
          >
            <span style={{ color: "#C4704B", fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
              5 AI MODELS · INDEPENDENT VERDICT
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              fontWeight: 700,
              margin: "0 0 12px",
              lineHeight: 1.2,
            }}
          >
            Did the AI actually do the job?
          </h1>
          <p style={{ color: "#A89B8C", fontSize: 16, margin: 0, lineHeight: 1.6 }}>
            Paste a GitHub PR or code — 5 independent AI models verify whether the work meets
            your requirements. Get a shareable report in seconds.
          </p>
        </div>

        {/* Free tier badge */}
        {!session && (
          <div
            style={{
              background: "rgba(212,184,150,0.08)",
              border: "1px solid rgba(212,184,150,0.2)",
              borderRadius: 12,
              padding: "10px 16px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#A89B8C",
            }}
          >
            <span style={{ color: "#D4B896" }}>✦</span>
            <span>
              <strong style={{ color: "#EDE6DD" }}>3 free verifications</strong> without an
              account.{" "}
              <Link href="/register" style={{ color: "#C4704B", textDecoration: "none" }}>
                Sign up free
              </Link>{" "}
              for more.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.2)",
              borderRadius: 16,
              padding: 24,
              marginBottom: 16,
            }}
          >
            {/* Task description */}
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#EDE6DD" }}>
                What was the AI supposed to do?
              </span>
            </label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="e.g. Fix 3 security issues: SQL injection in login route, XSS in comment field, hardcoded API key in config.ts"
              rows={3}
              maxLength={2000}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(196,112,75,0.25)",
                borderRadius: 10,
                color: "#EDE6DD",
                padding: "10px 12px",
                fontSize: 14,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                textAlign: "right",
                fontSize: 12,
                color: "#A89B8C",
                marginTop: 4,
              }}
            >
              {taskDescription.length}/2000
            </div>
          </div>

          {/* Checklist (optional) */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.15)",
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#EDE6DD",
                marginBottom: 12,
              }}
            >
              Checklist{" "}
              <span style={{ color: "#A89B8C", fontWeight: 400 }}>
                (optional — get per-item verdicts)
              </span>
            </div>

            {checklistItems.length > 0 && (
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    {item.severity && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: SEVERITY_COLORS[item.severity],
                          letterSpacing: 0.5,
                        }}
                      >
                        {item.severity}
                      </span>
                    )}
                    <span style={{ flex: 1, fontSize: 13 }}>{item.title}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#A89B8C",
                        cursor: "pointer",
                        fontSize: 16,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={newChecklistTitle}
                onChange={(e) => setNewChecklistTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addChecklistItem();
                  }
                }}
                placeholder="Add a specific thing to check..."
                maxLength={200}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(196,112,75,0.2)",
                  borderRadius: 8,
                  color: "#EDE6DD",
                  padding: "7px 10px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <select
                value={newChecklistSeverity}
                onChange={(e) =>
                  setNewChecklistSeverity(e.target.value as ChecklistItem["severity"])
                }
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(196,112,75,0.2)",
                  borderRadius: 8,
                  color: "#EDE6DD",
                  padding: "7px 10px",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
              <button
                type="button"
                onClick={addChecklistItem}
                disabled={!newChecklistTitle.trim() || checklistItems.length >= 20}
                style={{
                  background: "rgba(196,112,75,0.15)",
                  border: "1px solid rgba(196,112,75,0.3)",
                  borderRadius: 8,
                  color: "#C4704B",
                  padding: "7px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Proof input */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.2)",
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: 16,
            }}
          >
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(196,112,75,0.15)" }}>
              {(["pr", "code"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "12px 0",
                    background: tab === t ? "rgba(196,112,75,0.12)" : "transparent",
                    border: "none",
                    borderBottom: tab === t ? "2px solid #C4704B" : "2px solid transparent",
                    color: tab === t ? "#C4704B" : "#A89B8C",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t === "pr" ? "GitHub PR URL" : "Paste Code"}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {tab === "pr" ? (
                <>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#EDE6DD" }}>
                      GitHub Pull Request URL
                    </span>
                  </label>
                  <input
                    type="url"
                    value={prUrl}
                    onChange={(e) => setPrUrl(e.target.value)}
                    placeholder="https://github.com/owner/repo/pull/123"
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(196,112,75,0.25)",
                      borderRadius: 10,
                      color: "#EDE6DD",
                      padding: "10px 12px",
                      fontSize: 14,
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#A89B8C" }}>
                    The PR must be public. We fetch the diff, changed files, and CI status.
                  </p>
                </>
              ) : (
                <>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#EDE6DD" }}>
                      Paste code or output
                    </span>
                  </label>
                  <textarea
                    value={codeText}
                    onChange={(e) => setCodeText(e.target.value)}
                    placeholder="Paste the code, diff, or output you want to verify..."
                    rows={8}
                    maxLength={50_000}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(196,112,75,0.25)",
                      borderRadius: 10,
                      color: "#EDE6DD",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontFamily: "monospace",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ textAlign: "right", fontSize: 12, color: "#A89B8C", marginTop: 4 }}>
                    {codeText.length.toLocaleString()}/50,000
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 14,
                color: "#fca5a5",
              }}
            >
              {error}
              {requiresAccount && (
                <span>
                  {" "}
                  <Link href="/register" style={{ color: "#C4704B", fontWeight: 600 }}>
                    Create free account →
                  </Link>
                </span>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "rgba(196,112,75,0.4)" : "#C4704B",
              color: "#EDE6DD",
              border: "none",
              borderRadius: 12,
              padding: "14px 0",
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Verifying with 5 AI models…" : "Verify Work →"}
          </button>
        </form>

        {/* Footer callout */}
        <div
          style={{
            marginTop: 40,
            padding: 20,
            background: "rgba(212,184,150,0.06)",
            border: "1px solid rgba(212,184,150,0.15)",
            borderRadius: 14,
            textAlign: "center",
          }}
        >
          <p style={{ margin: "0 0 8px", color: "#A89B8C", fontSize: 14 }}>
            Want to automate this? Lock payment in escrow and release it only when cascrow
            confirms the work is done.
          </p>
          <Link
            href="/register"
            style={{
              color: "#C4704B",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Create a free escrow contract →
          </Link>
        </div>
      </div>
    </div>
  );
}
