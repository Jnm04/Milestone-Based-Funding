"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
      });
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      // Only show error for real server faults (5xx).
      // 4xx are intentionally swallowed — the API never reveals if an email exists.
      if (res.status >= 500) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          className="flex flex-col gap-6 p-8 rounded-2xl text-center"
          style={{ background: "hsl(24 12% 6% / 0.5)", border: "1px solid hsl(22 55% 54% / 0.15)" }}
        >
          {sent ? (
            <>
              <div style={{ fontSize: 32 }}>✉️</div>
              <h1
                className="text-2xl"
                style={{ fontFamily: "var(--font-inter-tight)", fontWeight: 300, color: "hsl(32 35% 92%)" }}
              >
                Check your inbox
              </h1>
              <p className="text-sm" style={{ color: "hsl(30 10% 62%)", lineHeight: 1.7 }}>
                If an account with <strong style={{ color: "hsl(32 35% 92%)" }}>{email}</strong> exists, we&apos;ve sent a reset link. It expires in 1 hour.
              </p>
              <Link href="/login" className="text-sm hover:underline" style={{ color: "hsl(22 55% 54%)" }}>
                Back to sign in →
              </Link>
            </>
          ) : (
            <>
              <div>
                <h1
                  className="text-2xl mb-1"
                  style={{ fontFamily: "var(--font-inter-tight)", fontWeight: 300, color: "hsl(32 35% 92%)" }}
                >
                  Forgot password?
                </h1>
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="cs-label">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="cs-input"
                    placeholder="you@example.com"
                  />
                </div>
                <Turnstile
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                  onError={() => setTurnstileToken(null)}
                  options={{ theme: "dark" }}
                />
                <button
                  type="submit"
                  disabled={loading || !turnstileToken}
                  className="cs-btn-primary w-full"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <Link href="/login" className="text-sm hover:underline" style={{ color: "hsl(30 10% 62%)" }}>
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
