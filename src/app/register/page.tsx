"use client";

import { useState, Suspense, useEffect, useCallback, useRef } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { toast } from "sonner";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

/* ── Password strength ───────────────────────────────────── */
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Weak",   color: "#f87171" },
    { label: "Fair",   color: "#fb923c" },
    { label: "Good",   color: "#facc15" },
    { label: "Strong", color: "#34d399" },
  ];
  return { score, ...map[Math.min(score, 3)] };
}

/* ── Role card ───────────────────────────────────────────── */
function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-1 flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-colors"
      style={{
        background: active ? "hsl(22 55% 54% / 0.08)" : "hsl(24 12% 6% / 0.5)",
        border: active ? "1px solid hsl(22 55% 54%)" : "1px solid hsl(28 18% 14%)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: active ? "hsl(22 55% 54% / 0.15)" : "hsl(28 18% 14%)" }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: active ? "hsl(32 35% 92%)" : "hsl(30 10% 62%)" }}>{title}</p>
      <p className="text-xs leading-snug" style={{ color: "hsl(30 10% 62%)" }}>{desc}</p>
      {active && (
        <div className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "hsl(22 55% 54%)" }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
    </button>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState<"INVESTOR" | "STARTUP">("INVESTOR");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const strength = pwStrength(password);

  const inputClass = "w-full rounded-lg border bg-background/60 px-4 py-3 text-sm text-foreground backdrop-blur-md outline-none transition-colors focus:border-primary";
  const inputStyle = { borderColor: "hsl(28 18% 14%)" };
  const labelClass = "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role, dateOfBirth: dateOfBirth || undefined, turnstileToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Registration failed.");
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        return;
      }
      const data = await res.json();
      posthog.identify(data.id, { role: data.role });
      posthog.capture("user_signed_up", { role, has_name: !!name });
      setRegistered(true);
      setResendCooldown(60);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const handleResend = useCallback(async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to resend. Please try again.");
        return;
      }
      toast.success("Verification email sent again. Check your inbox.");
      setResendCooldown(60);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }, [email]);

  /* ── Verification sent screen ── */
  if (registered) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(24 14% 4%)" }}>
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[500px] opacity-30" style={{ background: "radial-gradient(ellipse at top, hsl(22 65% 30% / 0.4), transparent 70%)" }} />
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 justify-center">
            <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
          </Link>
          <div className="gradient-border flex flex-col gap-5 p-8 rounded-2xl" style={{ background: "hsl(24 12% 6% / 0.6)", backdropFilter: "blur(20px)" }}>
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "hsl(142 50% 40% / 0.12)", border: "1px solid hsl(142 50% 40% / 0.2)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(142 50% 60%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>Check your email</h1>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>
                We sent a verification link to{" "}
                <span style={{ color: "hsl(32 35% 92%)" }}>{email}</span>.
                Click it to activate your account.
              </p>
              <p className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>
                The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="w-full rounded-full py-3 text-sm font-medium mt-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}
              >
                {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
              </button>
              <Link href="/login" className="text-sm hover:underline" style={{ color: "hsl(30 10% 62%)" }}>
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── Registration form ── */
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "hsl(24 14% 4%)" }}>
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[500px] opacity-30" style={{ background: "radial-gradient(ellipse at top, hsl(22 65% 30% / 0.4), transparent 70%)" }} />

      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 py-12">
        {/* ── Left: Form ── */}
        <div className="flex flex-col justify-center gap-6">
          <div>
            <Link href="/" className="mb-8 inline-flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md font-bold" style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: "hsl(24 14% 6%)" }}>c</span>
              <span className="text-sm font-semibold tracking-tight" style={{ color: "hsl(32 35% 92%)" }}>cascrow</span>
            </Link>
            <h1 className="mt-6 text-4xl font-semibold tracking-[-0.02em]" style={{ color: "hsl(32 35% 92%)" }}>Create account</h1>
            <p className="mt-2 text-sm" style={{ color: "hsl(30 10% 62%)" }}>Choose your role to get started.</p>
          </div>

          {/* Role selection */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>I am a…</label>
            <div className="flex gap-3">
              <RoleCard
                active={role === "INVESTOR"}
                onClick={() => setRole("INVESTOR")}
                title="Grant Giver"
                desc="I fund projects and lock RLUSD in escrow."
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={role === "INVESTOR" ? "hsl(22 55% 54%)" : "hsl(30 10% 62%)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  </svg>
                }
              />
              <RoleCard
                active={role === "STARTUP"}
                onClick={() => setRole("STARTUP")}
                title="Receiver"
                desc="I deliver milestones and receive funds."
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={role === "STARTUP" ? "hsl(22 55% 54%)" : "hsl(30 10% 62%)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.22L6.61 2a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17" />
                  </svg>
                }
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Your name or company"
              />
            </div>

            <div>
              <label className={labelClass}>
                Date of birth{" "}
                <span style={{ color: "hsl(30 10% 50%)", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>
                  — optional, improves sanctions screening
                </span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={inputClass}
                style={inputStyle}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Min. 8 characters"
              />
              {password && (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= strength.score ? strength.color : "hsl(28 18% 14%)" }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
                style={inputStyle}
                placeholder="Repeat your password"
              />
              {password && passwordConfirm && (
                <p className="text-xs mt-1" style={{ color: password === passwordConfirm ? "#34d399" : "#f87171" }}>
                  {password === passwordConfirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
              )}
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
              className="w-full rounded-full py-3 text-sm font-medium mt-1 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(22 65% 58%) 0%, hsl(28 75% 68%) 100%)", color: "hsl(24 14% 6%)" }}
            >
              {loading ? "Creating account…" : "Create account →"}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "hsl(28 18% 14%)" }} />
            <span className="text-xs" style={{ color: "hsl(30 10% 62%)" }}>or continue with</span>
            <div className="flex-1 h-px" style={{ background: "hsl(28 18% 14%)" }} />
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: callbackUrl || "/dashboard/investor" })}
              className="w-full inline-flex items-center justify-center gap-3 rounded-full border py-3 text-sm font-medium transition-colors"
              style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", color: "hsl(32 35% 92%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: callbackUrl || "/dashboard/investor" })}
              className="w-full inline-flex items-center justify-center gap-3 rounded-full border py-3 text-sm font-medium transition-colors"
              style={{ borderColor: "hsl(28 18% 14%)", background: "hsl(24 12% 6% / 0.5)", color: "hsl(32 35% 92%)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign up with GitHub
            </button>
          </div>

          <p className="text-sm text-center" style={{ color: "hsl(30 10% 62%)" }}>
            Already have an account?{" "}
            <Link
              href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
              className="font-medium hover:underline"
              style={{ color: "hsl(22 55% 54%)" }}
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* ── Right: Visual panel ── */}
        <div className="hidden md:flex flex-col justify-center items-center relative rounded-3xl overflow-hidden p-10" style={{ background: "hsl(24 12% 6% / 0.4)", border: "1px solid hsl(28 18% 14%)" }}>
          <div className="absolute inset-0 bg-aurora animate-aurora opacity-60" />
          <div className="relative z-10 flex flex-col gap-8 text-center">
            <blockquote className="text-xl font-semibold tracking-[-0.02em]" style={{ color: "hsl(32 35% 92%)" }}>
              &ldquo;We closed our first milestone payout in under 48 hours — no lawyers needed.&rdquo;
            </blockquote>
            <p className="text-sm" style={{ color: "hsl(30 10% 62%)" }}>— Marcus Weber, Orbital Seed</p>
            <div className="flex flex-col gap-4 pt-4 text-left">
              {[
                ["Free to start", "No setup fees. Pay only when funds move."],
                ["AI-verified", "5-model consensus — no single point of failure."],
                ["XRPL-native", "Escrow settled on-chain with full audit trail."],
              ].map(([label, desc]) => (
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

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
