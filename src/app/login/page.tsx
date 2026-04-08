"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { NodeBackground } from "@/components/node-background";

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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [autoSigningIn, setAutoSigningIn] = useState(false);

  // Poll for email verification every 3s — auto-login when verified on any device
  useEffect(() => {
    if (!unverifiedEmail) return;
    const savedPassword = password;
    const savedEmail = unverifiedEmail;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/check-verified?email=${encodeURIComponent(savedEmail)}`);
        const { verified } = await res.json();
        if (!verified) return;

        clearInterval(interval);
        setAutoSigningIn(true);
        const signInRes = await signIn("credentials", { email: savedEmail, password: savedPassword, redirect: false });
        if (signInRes?.ok && !signInRes?.error) {
          const sessionRes = await fetch("/api/auth/session");
          const session = await sessionRes.json();
          const role = session?.user?.role;
          if (callbackUrl && callbackUrl.startsWith("/")) {
            router.push(callbackUrl);
          } else if (role === "INVESTOR") {
            router.push("/dashboard/investor");
          } else if (role === "STARTUP") {
            router.push("/dashboard/startup");
          } else {
            router.push("/");
          }
        } else {
          // Verified but sign-in failed (edge case) — send back to login
          setAutoSigningIn(false);
          setUnverifiedEmail(null);
          toast.success("Email verified! Please sign in.");
        }
      } catch {
        // Network error — keep polling silently
      }
    }, 3000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unverifiedEmail]);

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Email verified! You can now sign in.");
    } else if (searchParams.get("error") === "invalid_token") {
      toast.error("Invalid or expired verification link.");
    } else if (searchParams.get("error") === "token_expired") {
      toast.error("Verification link has expired. Please register again.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });

      if (res?.error === "EmailNotVerified") {
        setUnverifiedEmail(email);
        return;
      }
      if (res?.error?.startsWith("TooManyAttempts:")) {
        const minutes = res.error.split(":")[1];
        toast.error(`Too many failed attempts. Account locked for ${minutes} minute${minutes === "1" ? "" : "s"}.`);
        return;
      }
      if (res?.error) {
        toast.error("Invalid email or password.");
        return;
      }

      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;

      if (callbackUrl && callbackUrl.startsWith("/")) {
        router.push(callbackUrl);
      } else if (role === "INVESTOR") {
        router.push("/dashboard/investor");
      } else if (role === "STARTUP") {
        router.push("/dashboard/startup");
      } else {
        router.push("/");
      }
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  }

  if (unverifiedEmail) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
        style={{ background: "#171311" }}
      >
        <NodeBackground />
        <div className="relative z-10 w-full max-w-md flex flex-col gap-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <Logo variant="full" />
          </div>
          <div
            className="flex flex-col gap-5 p-8 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
          >
            {autoSigningIn ? (
              <>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div style={{ width: 32, height: 32, border: "2px solid rgba(196,112,75,0.2)", borderTopColor: "#C4704B", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <h1 className="text-xl" style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}>
                    Email verified!
                  </h1>
                  <p className="text-sm" style={{ color: "#A89B8C" }}>Signing you in…</p>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl" style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}>
                  Verify your email
                </h1>
                <p className="text-sm" style={{ color: "#A89B8C" }}>
                  Your account is not yet verified. Check your inbox at{" "}
                  <strong style={{ color: "#EDE6DD" }}>{unverifiedEmail}</strong> or request a new link.
                </p>

                {/* Waiting indicator */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C4704B", animation: "pulse 1.4s ease-in-out infinite" }} />
                  <style>{`@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
                  <span className="text-xs" style={{ color: "#A89B8C" }}>Waiting for verification on any device…</span>
                </div>

                {resendDone ? (
                  <p className="text-sm font-medium" style={{ color: "#6EAF7C" }}>
                    Verification email sent! Check your inbox.
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="cs-btn-primary w-full"
                  >
                    {resendLoading ? "Sending…" : "Resend verification email"}
                  </button>
                )}
                <button
                  onClick={() => setUnverifiedEmail(null)}
                  className="text-sm hover:underline"
                  style={{ color: "#A89B8C" }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#171311" }}
    >
      <NodeBackground />
      {/* Subtle background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(196,112,75,0.06) 0%, transparent 70%)" }}
      />

      <div
        className="animate-fade-up relative z-10 w-full max-w-md flex flex-col gap-8"
        style={{ paddingTop: "2rem", paddingBottom: "2rem" }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <Logo variant="full" />
        </div>

        {/* Card */}
        <div
          className="flex flex-col gap-6 p-8 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
          }}
        >
          <div className="flex flex-col gap-1">
            <h1
              className="text-2xl"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
            >
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: "#A89B8C" }}>Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
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

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="cs-label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="cs-input"
                  style={{ paddingRight: 44 }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#A89B8C" }}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="cs-btn-primary w-full mt-1"
              style={{ width: "100%" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "rgba(196,112,75,0.15)" }} />
            <span className="text-xs" style={{ color: "#A89B8C" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(196,112,75,0.15)" }} />
          </div>

          {/* Footer */}
          <p className="text-sm text-center" style={{ color: "#A89B8C" }}>
            Don&apos;t have an account?{" "}
            <Link
              href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}
              style={{ color: "#C4704B" }}
              className="font-medium hover:underline"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
