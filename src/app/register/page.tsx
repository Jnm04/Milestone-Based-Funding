"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"INVESTOR" | "STARTUP">("INVESTOR");
  const [loading, setLoading] = useState(false);

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

      // Auto-login after registration
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        toast.error("Registered but login failed — please sign in manually.");
        router.push("/login");
        return;
      }

      toast.success("Account created! Welcome to Prova.");
      router.push(callbackUrl ?? (role === "INVESTOR" ? "/dashboard/investor" : "/dashboard/startup"));
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-6">
        <div>
          <Link href="/" className="font-bold text-lg tracking-tight">Prova</Link>
          <h1 className="text-2xl font-bold mt-4">Create account</h1>
          <p className="text-sm text-muted-foreground mt-1">Join Prova</p>
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
