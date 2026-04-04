"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  // Show feedback from email verification redirects
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
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error === "EmailNotVerified") {
        setUnverifiedEmail(email);
        return;
      }

      if (res?.error) {
        toast.error("Invalid email or password.");
        return;
      }

      // Fetch session to get role and redirect
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
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-4 text-center">
          <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
          <h1 className="text-2xl font-bold mt-2">Verify your email</h1>
          <p className="text-sm text-muted-foreground">
            Your account is not yet verified. Check your inbox at <strong>{unverifiedEmail}</strong> or request a new link.
          </p>
          {resendDone ? (
            <p className="text-sm text-green-600 font-medium">Verification email sent! Check your inbox.</p>
          ) : (
            <Button onClick={handleResend} disabled={resendLoading}>
              {resendLoading ? "Sending…" : "Resend verification email"}
            </Button>
          )}
          <button onClick={() => setUnverifiedEmail(null)} className="text-sm text-muted-foreground hover:underline">
            Back to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-6">
        <div>
          <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
          <h1 className="text-2xl font-bold mt-4">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          No account?{" "}
          <Link
            href={callbackUrl ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}
            className="font-medium text-zinc-900 hover:underline"
          >
            Register
          </Link>
        </p>
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
