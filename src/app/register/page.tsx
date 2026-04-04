"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"INVESTOR" | "STARTUP">("INVESTOR");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role }),
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

  // Countdown timer for resend cooldown
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

  if (registered) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-4 text-center">
          <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
          <div className="flex flex-col gap-2 mt-2">
            <h1 className="text-2xl font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resendCooldown > 0 || resending}
            className="mt-2"
          >
            {resending
              ? "Sending…"
              : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend verification email"}
          </Button>
          <Link href="/login" className="text-sm font-medium text-zinc-900 hover:underline">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-6">
        <div>
          <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
          <h1 className="text-2xl font-bold mt-4">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join Cascrow</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">I am a…</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole("INVESTOR")}
                className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={role === "INVESTOR" ? { backgroundColor: "#18181b", color: "#fff", borderColor: "#18181b" } : { backgroundColor: "#fff", color: "#3f3f46" }}
              >
                Grant Giver
              </button>
              <button
                type="button"
                onClick={() => setRole("STARTUP")}
                className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={role === "STARTUP" ? { backgroundColor: "#18181b", color: "#fff", borderColor: "#18181b" } : { backgroundColor: "#fff", color: "#3f3f46" }}
              >
                Receiver
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Your name or company"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Min. 8 characters"
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            Sign in
          </Link>
        </p>
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
