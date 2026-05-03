"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Lock, Cpu, Coins } from "lucide-react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.alreadyRegistered) return setState("duplicate");
      if (!res.ok) return setState("error");
      setState("success");
    } catch {
      setState("error");
    }
  }

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24"
      style={{ background: "hsl(24 8% 8%)", color: "hsl(32 35% 92%)" }}
    >
      {/* Logo */}
      <Link href="/" className="mb-16 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "hsl(22 55% 54%)" }}>
          cascrow
        </span>
      </Link>

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8" style={{ background: "linear-gradient(90deg, transparent, hsl(22 55% 54%))" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.22em", color: "hsl(22 55% 54%)" }}>
              Early access
            </span>
            <span className="h-px w-8" style={{ background: "linear-gradient(90deg, hsl(22 55% 54%), transparent)" }} />
          </div>
          <h1
            className="mb-4 text-4xl font-bold leading-tight tracking-tight"
            style={{ fontFamily: "'Inter Tight', sans-serif" }}
          >
            The trust layer for{" "}
            <span style={{ background: "linear-gradient(135deg, hsl(22 65% 58%), hsl(32 75% 68%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              agents.
            </span>
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "hsl(30 10% 62%)" }}>
            Cascrow launches publicly soon. Join the waitlist to be first in — early access, priority onboarding, and founding-user pricing.
          </p>
        </div>

        {/* Features */}
        <div className="mb-10 grid grid-cols-3 gap-4">
          {[
            { icon: Lock, label: "Escrow on XRPL" },
            { icon: Cpu, label: "5-model AI vote" },
            { icon: Coins, label: "$0.10/verification" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-lg p-4 text-center"
              style={{ background: "hsl(24 8% 11%)", border: "1px solid hsl(24 8% 16%)" }}
            >
              <Icon size={16} style={{ color: "hsl(22 55% 54%)" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", color: "hsl(30 10% 62%)" }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Form */}
        <div
          className="rounded-xl p-8"
          style={{ background: "hsl(24 8% 11%)", border: "1px solid hsl(24 8% 16%)" }}
        >
          {state === "success" ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "hsl(22 55% 54% / 0.15)", border: "1px solid hsl(22 55% 54% / 0.3)" }}
              >
                <Check size={20} style={{ color: "hsl(22 55% 54%)" }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: "hsl(32 35% 92%)" }}>You're on the list.</p>
                <p className="mt-1 text-sm" style={{ color: "hsl(30 10% 62%)" }}>
                  We'll reach out when early access opens.
                </p>
              </div>
              <Link
                href="/"
                className="mt-2 text-sm underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: "hsl(22 55% 54%)" }}
              >
                Back to cascrow.com
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.18em", color: "hsl(30 10% 62%)" }}>
                  Email address
                </span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={state === "loading"}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all focus:ring-1"
                  style={{
                    background: "hsl(24 8% 8%)",
                    border: "1px solid hsl(24 8% 20%)",
                    color: "hsl(32 35% 92%)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              </label>

              {state === "duplicate" && (
                <p className="text-sm" style={{ color: "hsl(22 55% 54%)" }}>
                  You're already on the list.
                </p>
              )}
              {state === "error" && (
                <p className="text-sm" style={{ color: "hsl(0 65% 60%)" }}>
                  Something went wrong. Try again.
                </p>
              )}

              <button
                type="submit"
                disabled={state === "loading"}
                className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, hsl(22 65% 54%), hsl(30 70% 60%))",
                  color: "hsl(24 8% 8%)",
                  fontFamily: "'Inter Tight', sans-serif",
                }}
              >
                {state === "loading" ? "Joining..." : "Join the waitlist"}
                {state !== "loading" && <ArrowRight size={15} />}
              </button>

              <p className="text-center text-xs" style={{ color: "hsl(30 10% 45%)" }}>
                No spam. We email once when access opens.
              </p>
            </form>
          )}
        </div>

        {/* Footer link */}
        <p className="mt-8 text-center text-sm" style={{ color: "hsl(30 10% 45%)" }}>
          Already have an account?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:opacity-70 transition-opacity" style={{ color: "hsl(22 55% 54%)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
