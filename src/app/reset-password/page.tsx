"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [done, setDone]           = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm" style={{ color: "#ef4444" }}>Invalid reset link — no token found.</p>
        <Link href="/forgot-password" style={{ color: "hsl(22 55% 54%)" }} className="text-sm hover:underline">
          Request a new one →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login?reset=1"), 2500);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div style={{ fontSize: 32 }}>✓</div>
        <h1
          className="text-xl"
          style={{ fontFamily: "var(--font-inter-tight)", fontWeight: 300, color: "hsl(32 35% 92%)" }}
        >
          Password updated!
        </h1>
        <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <>
      <div>
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: "var(--font-inter-tight)", fontWeight: 300, color: "hsl(32 35% 92%)" }}
        >
          Set new password
        </h1>
        <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
          Choose a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="cs-label">New password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cs-input"
              style={{ paddingRight: 44 }}
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "hsl(30 10% 62%)" }}
              tabIndex={-1}
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="cs-label">Confirm password</label>
          <input
            type={showPw ? "text" : "password"}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="cs-input"
            placeholder="Repeat password"
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cs-btn-primary w-full mt-1"
        >
          {loading ? "Saving…" : "Set new password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "hsl(24 14% 4%)" }}
    >
      <div className="relative z-10 w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
        </div>
        <div
          className="flex flex-col gap-6 p-8 rounded-2xl"
          style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.15)" }}
        >
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
