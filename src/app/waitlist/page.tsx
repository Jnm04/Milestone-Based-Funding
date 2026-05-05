"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, AlertCircle, Lock, Cpu, Link2, Github, Mail, Check } from "lucide-react";

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
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora animate-aurora opacity-70" />
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 10%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(22 70% 45% / 0.5), transparent 70%)" }}
      />

      <header className="container-tight flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-copper font-mono text-sm font-bold text-primary-foreground">
            c
          </span>
          <span className="text-sm font-semibold tracking-tight">cascrow</span>
        </Link>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <section className="container-tight flex flex-col items-center pb-24 pt-12 md:pt-20">
        {/* Terminal header */}
        <div className="mb-10 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
          <span className="text-muted-foreground">cascrow ~/access</span>
          <span className="text-primary">›</span>
          <span className="text-foreground">join-waitlist</span>
          <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-primary" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-3">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary" />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">Early access</span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary" />
          </div>

          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-gradient md:text-6xl">
            The trust layer for{" "}
            <span className="text-gradient-copper">agents.</span>
          </h1>

          {/* Status banner */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="gradient-border mx-auto mt-10 flex items-start gap-3 rounded-2xl bg-card/40 p-5 text-left backdrop-blur-md"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">All waitlist spots are currently full.</span>{" "}
              Leave your email and we&apos;ll notify you as soon as a spot opens up.
            </p>
          </motion.div>
        </motion.div>

        {/* Pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {[
            { icon: Lock, label: "Escrow on XRPL" },
            { icon: Cpu, label: "5-model AI vote" },
            { icon: Link2, label: "$0.10/verification" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="gradient-border rounded-2xl bg-card/30 p-5 text-center backdrop-blur-md transition-colors hover:bg-card/50"
            >
              <Icon className="mx-auto h-4 w-4 text-primary" />
              <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">{label}</div>
            </div>
          ))}
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="gradient-border mt-8 w-full max-w-2xl rounded-2xl bg-card/40 p-6 backdrop-blur-md md:p-8"
        >
          {state === "success" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="py-6 text-center"
            >
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-copper text-primary-foreground">
                ✓
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">You&apos;re on the list.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We&apos;ll send <span className="font-mono text-foreground">{email}</span> a single email the moment a spot opens.
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={state === "loading"}
                    className="w-full rounded-lg border border-border bg-background/60 py-3 pl-10 pr-4 text-sm text-foreground outline-none transition-colors focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              {state === "duplicate" && (
                <p className="text-sm text-primary">You&apos;re already on the list.</p>
              )}
              {state === "error" && (
                <p className="text-sm" style={{ color: "hsl(0 65% 60%)" }}>Something went wrong. Try again.</p>
              )}

              <button
                type="submit"
                disabled={state === "loading"}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-copper px-5 py-3 text-sm font-medium text-primary-foreground glow-on-hover disabled:opacity-50"
              >
                {state === "loading" ? "Submitting…" : "Notify me when a spot opens"}
                {state !== "loading" && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                No spam. One email when your spot opens.
              </p>
            </form>
          )}
        </motion.div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </section>

      <footer className="container-tight flex items-center justify-between border-t border-border py-6 text-xs text-muted-foreground">
        <span className="font-mono">© cascrow · {new Date().getFullYear()}</span>
        <div className="flex items-center gap-5">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/datenschutz" className="hover:text-foreground">Privacy</Link>
          <a
            href="https://github.com/Jnm04/Milestone-Based-Funding"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" /> source
          </a>
        </div>
      </footer>
    </main>
  );
}
