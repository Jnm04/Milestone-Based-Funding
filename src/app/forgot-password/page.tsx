"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { NodeBackground } from "@/components/node-background";

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
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
      style={{ background: "#171311" }}
    >
      <NodeBackground />
      <div className="relative z-10 w-full max-w-md flex flex-col gap-8">
        <div className="flex flex-col items-center gap-2">
          <Logo variant="full" />
        </div>

        <div
          className="flex flex-col gap-6 p-8 rounded-2xl text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
        >
          {sent ? (
            <>
              <div style={{ fontSize: 32 }}>✉️</div>
              <h1
                className="text-2xl"
                style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
              >
                Check your inbox
              </h1>
              <p className="text-sm" style={{ color: "#A89B8C", lineHeight: 1.7 }}>
                If an account with <strong style={{ color: "#EDE6DD" }}>{email}</strong> exists, we&apos;ve sent a reset link. It expires in 1 hour.
              </p>
              <Link href="/login" className="text-sm hover:underline" style={{ color: "#C4704B" }}>
                Back to sign in →
              </Link>
            </>
          ) : (
            <>
              <div>
                <h1
                  className="text-2xl mb-1"
                  style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
                >
                  Forgot password?
                </h1>
                <p className="text-sm" style={{ color: "#A89B8C" }}>
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
                <button
                  type="submit"
                  disabled={loading}
                  className="cs-btn-primary w-full"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <Link href="/login" className="text-sm hover:underline" style={{ color: "#A89B8C" }}>
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
