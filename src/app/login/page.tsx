"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

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
  const [ssoRequired, setSsoRequired] = useState(false);
  const [ssoProviderLabel, setSsoProviderLabel] = useState("SSO");
  const [ssoChecking, setSsoChecking] = useState(false);

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
            router.push("/dashboard/investor");
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

  async function checkSso(emailValue: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return;
    setSsoChecking(true);
    try {
      const res = await fetch(`/api/auth/sso/check?email=${encodeURIComponent(emailValue)}`);
      const data = await res.json() as { ssoRequired?: boolean; providerLabel?: string };
      setSsoRequired(!!data.ssoRequired);
      if (data.ssoRequired) setSsoProviderLabel(data.providerLabel ?? "SSO");
    } catch {
      // Ignore — fall back to password login
    } finally {
      setSsoChecking(false);
    }
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setSsoRequired(false);
  }

  function handleEmailBlur() {
    if (email) checkSso(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // SSO domain — redirect to IdP instead of password login
    if (ssoRequired) {
      window.location.href = `/api/auth/sso/initiate?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl ?? "/dashboard/investor")}`;
      return;
    }
    setLoading(true);
    try {
      const creds: Record<string, string> = { email, password, redirect: "false" };
      if (totpRequired) creds.totpCode = totpCode;
      const res = await signIn("credentials", { ...creds, redirect: false });

      if (res?.error === "SsoRequired") {
        setSsoRequired(true);
        setLoading(false);
        return;
      }
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

  const inputClass = "w-full rounded-lg border bg-background/60 px-4 py-3 text-sm text-foreground backdrop-blur-md outline-none transition-colors focus:border-primary";
  const inputStyle = { borderColor: "hsl(28 18% 14%)" };
  const labelClass = "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground";

  if (unverifiedEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(24 14% 4%)" }}>
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 justify-center">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <div className="gradient-border flex flex-col gap-5 p-8 rounded-2xl" style={{ background: "hsl(24 12% 6% / 0.6)", backdropFilter: "blur(20px)" }}>
            {autoSigningIn ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div style={{ width: 32, height: 32, border: "2px solid hsl(22 55% 54% / 0.2)", borderTopColor: "hsl(22 55% 54%)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <h1 className="text-xl font-semibold" style={{ color: "hsl(32 35% 92%)" }}>Email verified!</h1>
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>Signing you in…</p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>Verify your email</h1>
                <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                  Check your inbox at <strong style={{ color: "hsl(32 35% 92%)" }}>{unverifiedEmail}</strong> or request a new link.
                </p>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse-dot" style={{ background: "hsl(22 55% 54%)" }} />
                  <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Waiting for verification on any device…</span>
                </div>
                {resendDone ? (
                  <p className="text-sm font-medium" style={{ color: "hsl(142 50% 60%)" }}>Verification email sent! Check your inbox.</p>
                ) : (
                  <button onClick={handleResend} disabled={resendLoading} className="w-full rounded-full py-3 text-sm font-medium" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}>
                    {resendLoading ? "Sending…" : "Resend verification email"}
                  </button>
                )}
                <button onClick={() => setUnverifiedEmail(null)} className="text-sm hover:underline text-center" style={{ color: "hsl(30 10% 62%)" }}>Back to sign in</button>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(24 14% 4%)" }}>
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[500px] opacity-30" style={{ background: "radial-gradient(ellipse at top, hsl(22 65% 30% / 0.4), transparent 70%)" }} />

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 py-12">
        {/* ── Left: Form ── */}
        <div className="flex flex-col justify-center gap-8">
          <div>
            <Link href="/" className="mb-8 inline-flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
              <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
            </Link>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.02em]" style={{ color: "hsl(32 35% 92%)" }}>Sign in</h1>
            <p className="mt-2 text-sm" style={{ color: "hsl(30 10% 62%)" }}>Access your escrow contracts and milestones.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Email address</label>
              <input type="email" required value={email} onChange={handleEmailChange} onBlur={handleEmailBlur} className={inputClass} style={inputStyle} placeholder="you@example.com" />
              {ssoChecking && <p className="mt-1 text-xs" style={{ color: "hsl(30 10% 62%)" }}>Checking sign-in method…</p>}
            </div>

            {ssoRequired && (
              <div className="rounded-lg p-4 text-sm" style={{ background: "hsl(220 70% 50% / 0.1)", border: "1px solid hsl(220 70% 50% / 0.3)" }}>
                <p className="font-medium mb-1" style={{ color: "hsl(210 80% 70%)" }}>Your organisation uses {ssoProviderLabel}</p>
                <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>Click below to continue through your company&apos;s identity provider.</p>
              </div>
            )}

            {!ssoRequired && (
              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} style={{ ...inputStyle, paddingRight: 44 }} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(30 10% 62%)" }} tabIndex={-1}><EyeIcon open={showPw} /></button>
                </div>
              </div>
            )}

            {totpRequired && !ssoRequired && (
              <div>
                <label className={labelClass}>Authenticator code</label>
                <input type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))} className={inputClass} style={{ ...inputStyle, letterSpacing: "0.25em", fontSize: 20, textAlign: "center" }} placeholder="000000" />
                <p className="mt-1 text-xs" style={{ color: "hsl(30 10% 62%)" }}>Enter the 6-digit code from your authenticator app.</p>
              </div>
            )}

            {!totpRequired && !ssoRequired && (
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-xs hover:underline" style={{ color: "hsl(30 10% 62%)" }}>Forgot password?</Link>
              </div>
            )}

            <button type="submit" disabled={loading || (!ssoRequired && totpRequired && totpCode.length !== 6)} className="w-full rounded-full py-3 text-sm font-medium mt-1 disabled:opacity-50" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}>
              {loading ? "Redirecting…" : ssoRequired ? `Sign in with ${ssoProviderLabel}` : totpRequired ? "Verify code" : "Sign in →"}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "hsl(28 18% 14%)" }} />
            <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: "hsl(28 18% 14%)" }} />
          </div>

          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => signIn("google", { callbackUrl: callbackUrl || "/dashboard/investor" })} className="w-full inline-flex items-center justify-center gap-3 rounded-full border py-3 text-sm font-medium transition-colors" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", color: "hsl(32 35% 92%)" }}>
              <svg width="16" height="16" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
              Sign in with Google
            </button>
            <button type="button" onClick={() => signIn("github", { callbackUrl: callbackUrl || "/dashboard/investor" })} className="w-full inline-flex items-center justify-center gap-3 rounded-full border py-3 text-sm font-medium transition-colors" style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", color: "hsl(32 35% 92%)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              Sign in with GitHub
            </button>
          </div>

          <p className="text-sm text-center" style={{ color: "hsl(30 10% 62%)" }}>
            Don&apos;t have an account?{" "}
            <Link href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"} className="font-medium hover:underline" style={{ color: "hsl(22 55% 54%)" }}>Register</Link>
          </p>
        </div>

        {/* ── Right: Visual panel ── */}
        <div className="hidden md:flex flex-col justify-center items-center relative rounded-3xl overflow-hidden p-10" style={{ background: "hsl(24 12% 6% / 0.4)", border: "1px solid hsl(28 18% 14%)" }}>
          <div className="absolute inset-0 bg-aurora animate-aurora opacity-60" />
          <div className="relative z-10 flex flex-col gap-8 text-center">
            <blockquote className="text-xl font-semibold tracking-[-0.02em]" style={{ color: "hsl(32 35% 92%)" }}>
              &ldquo;Cascrow turns three weeks of back-and-forth into a single API call.&rdquo;
            </blockquote>
            <div>
              <p className="text-sm font-medium" style={{ color: "hsl(32 35% 92%)" }}>Jan-Niklas Möller</p>
              <p className="text-xs mt-0.5" style={{ color: "hsl(30 10% 62%)" }}>Co-Founder of Cascrow</p>
            </div>
            <div className="flex flex-col gap-4 pt-4 text-left">
              {[["Non-custodial", "You stay in control of all funds."], ["EU-region", "Compliant with GDPR & financial regulations."], ["5-model quorum", "Consensus across leading AI providers."]].map(([label, desc]) => (
                <div key={label}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] mb-0.5" style={{ color: "hsl(22 55% 54%)" }}>{label}</div>
                  <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
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
