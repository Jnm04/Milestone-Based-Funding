"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function InvestorDashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "INVESTOR") router.push("/dashboard/startup");
  }, [status, session, router]);

  async function handleWalletConnected(address: string) {
    setSavingWallet(true);
    try {
      const res = await fetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save wallet");
      }
      await update({ walletAddress: address });
      toast.success("Wallet connected!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save wallet.");
    } finally {
      setSavingWallet(false);
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!session) return null;

  const walletAddress = session.user.walletAddress;

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">MilestoneFund</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
          <Badge variant="outline">Investor</Badge>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Investor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {walletAddress
              ? "Create contracts and lock funds in escrow."
              : "Connect your XRPL wallet to create contracts."}
          </p>
        </div>

        {!walletAddress ? (
          <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border">
            <p className="text-sm font-medium">Connect your XRPL wallet via Xaman</p>
            <p className="text-xs text-muted-foreground">You only need to do this once. Your wallet is saved to your account.</p>
            <WalletConnect role="INVESTOR" onConnected={handleWalletConnected} />
            {savingWallet && <p className="text-xs text-muted-foreground">Saving wallet…</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">XRPL Wallet</p>
                <code className="text-sm font-mono">{walletAddress}</code>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
            </div>

            <Link href={`/contract/new?investor=${walletAddress}`}>
              <Button size="lg" className="w-full">
                + Create New Contract
              </Button>
            </Link>

            <div className="p-6 bg-white rounded-xl border">
              <p className="text-sm text-muted-foreground text-center">
                Your contracts will appear here once created.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
