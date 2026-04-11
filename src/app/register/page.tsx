"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { NodeBackground } from "@/components/node-background";

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
      className="flex-1 flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-colors"
      style={{
        background: active ? "rgba(196,112,75,0.08)" : "rgba(255,255,255,0.02)",
        border: active ? "1px solid #C4704B" : "1px solid rgba(196,112,75,0.15)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ background: active ? "rgba(196,112,75,0.15)" : "rgba(255,255,255,0.04)" }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: active ? "#EDE6DD" : "#A89B8C" }}>{title}</p>
      <p className="text-xs leading-snug" style={{ color: "#A89B8C" }}>{desc}</p>
      {active && (
        <div className="absolute top-3 right-3 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "#C4704B" }}>
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
  const [role, setRole] = useState<"INVESTOR" | "STARTUP">("INVESTOR");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const strength = pwStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role, dateOfBirth: dateOfBirth || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Registration failed.");
        return;
      }
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
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "#171311" }}
      >
        <div
          className="animate-fade-up w-full max-w-md flex flex-col items-center gap-6 p-8 rounded-2xl text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
        >
          <Logo variant="full" />

          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>

          <div className="flex flex-col gap-2">
            <h1
              className="text-2xl"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
            >
              Check your email
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "#A89B8C" }}>
              We sent a verification link to{" "}
              <span style={{ color: "#EDE6DD" }}>{email}</span>.
              Click it to activate your account.
            </p>
            <p className="text-xs" style={{ color: "#A89B8C" }}>
              The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
            </p>
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="cs-btn-ghost cs-btn-sm w-full"
          >
            {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
          </button>

          <Link href="/login" className="text-sm" style={{ color: "#C4704B" }}>
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  /* ── Registration form ── */
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: "#171311" }}
    >
      <NodeBackground />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(196,112,75,0.05) 0%, transparent 70%)" }}
      />

      <div className="animate-fade-up relative z-10 w-full max-w-md flex flex-col gap-7">
        <div className="flex flex-col items-center gap-2">
          <Logo variant="full" />
        </div>

        <div
          className="flex flex-col gap-6 p-8 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
        >
          <div className="flex flex-col gap-1">
            <h1
              className="text-2xl"
              style={{ fontFamily: "var(--font-libre-franklin)", fontWeight: 300, color: "#EDE6DD" }}
            >
              Create your account
            </h1>
            <p className="text-sm" style={{ color: "#A89B8C" }}>Choose your role to get started</p>
          </div>

          {/* Role selection */}
          <div className="flex flex-col gap-2">
            <label className="cs-label">I am a…</label>
            <div className="flex gap-3 relative">
              <RoleCard
                active={role === "INVESTOR"}
                onClick={() => setRole("INVESTOR")}
                title="Grant Giver"
                desc="I fund projects and lock RLUSD in escrow."
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={role === "INVESTOR" ? "#C4704B" : "#A89B8C"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={role === "STARTUP" ? "#C4704B" : "#A89B8C"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.22L6.61 2a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17" />
                  </svg>
                }
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="cs-label">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="cs-input"
                placeholder="Your name or company"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="cs-label">
                Date of birth <span style={{ color: "#A89B8C", fontWeight: 400 }}>(optional — improves sanctions screening accuracy)</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="cs-input"
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

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

            <div className="flex flex-col gap-1.5">
              <label className="cs-label">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cs-input"
                placeholder="Min. 8 characters"
              />
              {/* Strength bar */}
              {password && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background: i <= strength.score ? strength.color : "rgba(255,255,255,0.08)",
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cs-btn-primary w-full mt-1"
              style={{ width: "100%" }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-center" style={{ color: "#A89B8C" }}>
            Already have an account?{" "}
            <Link
              href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"}
              className="font-medium hover:underline"
              style={{ color: "#C4704B" }}
            >
              Sign in
            </Link>
          </p>
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
