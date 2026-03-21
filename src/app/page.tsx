import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="font-bold text-xl tracking-tight">MilestoneFund</span>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="outline" size="sm">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <Badge variant="secondary" className="text-sm">
          Live on XRPL Testnet · XLS-85 · RLUSD Escrow
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight max-w-2xl leading-tight">
          Milestone-based funding.<br />Verified by AI.
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Lock RLUSD in native XRPL escrow. Funds release automatically when Claude AI
          confirms your milestone is met. No middlemen, no volatility, instant settlement.
        </p>
        <div className="flex gap-4 mt-4">
          <Link href="/register">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">Sign in</Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-zinc-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Create Contract",
                desc: "Investor defines the milestone and locks RLUSD in native XRPL escrow via Xaman wallet.",
              },
              {
                step: "2",
                title: "Upload Proof",
                desc: "Startup uploads a PDF document proving the milestone is complete.",
              },
              {
                step: "3",
                title: "AI Decides",
                desc: "Claude AI reads the proof and releases funds instantly on YES, or notifies on NO.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col gap-3 p-6 bg-white rounded-xl border">
                <span className="text-3xl font-bold text-zinc-200">{item.step}</span>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech badges */}
      <section className="py-12 px-6 flex flex-wrap gap-3 justify-center border-t">
        {["XRPL Native Escrow", "XLS-85 Amendment", "RLUSD Stablecoin", "Claude AI", "Xaman Wallet", "No Smart Contracts"].map(
          (tag) => (
            <Badge key={tag} variant="outline" className="text-sm px-4 py-1.5">
              {tag}
            </Badge>
          )
        )}
      </section>
    </main>
  );
}
