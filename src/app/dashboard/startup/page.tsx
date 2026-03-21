"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Suspense } from "react";

function StartupDashboardContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [joining, setJoining] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      const callbackUrl = inviteCode
        ? `/dashboard/startup?invite=${inviteCode}`
        : "/dashboard/startup";
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    if (status === "authenticated" && session.user.role !== "STARTUP") router.push("/dashboard/investor");
  }, [status, session, router, inviteCode]);

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

  async function handleJoinContract() {
    if (!session?.user.walletAddress || !inviteCode) return;
    setJoining(true);
    try {
      const res = await fetch("/api/contracts/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to join contract");
      }
      const { contractId } = await res.json();
      toast.success("You have joined the contract!");
      window.location.href = `/contract/${contractId}?startup=${session.user.walletAddress}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join.");
    } finally {
      setJoining(false);
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
          <Badge variant="outline">Startup</Badge>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Startup Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {inviteCode
              ? "Connect your wallet to accept the contract invitation."
              : walletAddress
              ? "Your dashboard."
              : "Connect your XRPL wallet to get started."}
          </p>
        </div>

        {inviteCode && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            You have been invited to a contract. Connect your wallet to accept.
          </div>
        )}

        {!walletAddress ? (
          <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border">
            <p className="text-sm font-medium">Connect your XRPL wallet via Xaman</p>
            <p className="text-xs text-muted-foreground">You only need to do this once.</p>
            <WalletConnect role="STARTUP" onConnected={handleWalletConnected} />
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

            {inviteCode && (
              <Button size="lg" onClick={handleJoinContract} disabled={joining}>
                {joining ? "Joining…" : "Accept Contract Invitation"}
              </Button>
            )}

            {!inviteCode && (
              <div className="p-6 bg-white rounded-xl border">
                <p className="text-sm text-muted-foreground text-center">
                  Your contracts will appear here. Ask the investor to share an invite link.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function StartupDashboard() {
  return (
    <Suspense>
      <StartupDashboardContent />
    </Suspense>
  );
}
