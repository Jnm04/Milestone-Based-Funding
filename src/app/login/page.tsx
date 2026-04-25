"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
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
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");

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
          } else if (session?.user?.isEnterprise) {
            router.push("/enterprise/dashboard");
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
    } else if (searchParams.get("reset") === "1") {
      toast.success("Password updated! You can now sign in.");
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
      const creds: Record<string, string> = { email, password, redirect: "false" };
      if (totpRequired) creds.totpCode = totpCode;
      const res = await signIn("credentials", { ...creds, redirect: false });

      if (res?.error === "EmailNotVerified") {
        setUnverifiedEmail(email);
        return;
      }
      if (res?.error === "TooManyAttempts" || res?.error?.startsWith("TooManyAttempts")) {
        toast.error("Too many failed attempts. Please try again later.");
        return;
      }
      if (res?.error === "TotpRequired") {
        setTotpRequired(true);
        setLoading(false);
        return;
      }
      if (res?.error === "TotpInvalid") {
        toast.error("Invalid 2FA code. Please try again.");
        setTotpCode("");
        return;
      }
      if (res?.error) {
        toast.error("Invalid email or password.");
        return;
      }

      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;
      const userId = session?.user?.id;

      if (userId) {
        posthog.identify(userId, { role });
        posthog.capture("user_logged_in", { role });
      }

      if (callbackUrl && callbackUrl.startsWith("/")) {
        router.push(callbackUrl);
      } else if (session?.user?.isEnterprise) {
        router.push("/enterprise/dashboard");
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

            {/* 2FA code (shown after TOTP_REQUIRED error) */}
            {totpRequired && (
              <div className="flex flex-col gap-1.5">
                <label className="cs-label">Authenticator code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                  className="cs-input"
                  placeholder="000000"
                  style={{ letterSpacing: "0.25em", fontSize: 20, textAlign: "center" }}
                />
                <p className="text-xs" style={{ color: "#A89B8C" }}>Enter the 6-digit code from your authenticator app.</p>
              </div>
            )}

            {/* Forgot password */}
            {!totpRequired && (
              <div className="flex justify-end -mt-2">
                <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: "#A89B8C" }}>
                  Forgot password?
                </Link>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (totpRequired && totpCode.length !== 6)}
              className="cs-btn-primary w-full mt-1"
              style={{ width: "100%" }}
            >
              {loading ? "Signing in…" : totpRequired ? "Verify code" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: "rgba(196,112,75,0.15)" }} />
            <span className="text-xs" style={{ color: "#A89B8C" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(196,112,75,0.15)" }} />
          </div>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: callbackUrl || "/dashboard/investor" })}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                width: "100%", padding: "10px 16px", borderRadius: 8,
                background: "white", border: "1px solid #dadce0",
                color: "#3c4043", fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "Roboto, sans-serif",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: callbackUrl || "/dashboard/investor" })}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                width: "100%", padding: "10px 16px", borderRadius: 8,
                background: "#24292e", border: "1px solid #444d56",
                color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "Roboto, sans-serif",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in with GitHub
            </button>

            <button
              type="button"
              onClick={() => signIn("linkedin", { callbackUrl: callbackUrl || "/dashboard/investor" })}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                width: "100%", padding: "10px 16px", borderRadius: 8,
                background: "#0a66c2", border: "1px solid #0a66c2",
                color: "white", fontSize: 14, fontWeight: 500, cursor: "pointer",
                fontFamily: "Roboto, sans-serif",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Sign in with LinkedIn
            </button>
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
