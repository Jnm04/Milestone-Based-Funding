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

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  AWAITING_ESCROW: "Warte auf Escrow",
  FUNDED: "Finanziert",
  PROOF_SUBMITTED: "Nachweis eingereicht",
  PENDING_REVIEW: "Manuelle Prüfung",
  VERIFIED: "Verifiziert",
  REJECTED: "Abgelehnt",
  DECLINED: "Einladung abgelehnt",
  EXPIRED: "Abgelaufen",
  COMPLETED: "Abgeschlossen",
};

const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  DRAFT:            { background: "#f4f4f5", color: "#52525b" },
  AWAITING_ESCROW:  { background: "#fef9c3", color: "#854d0e" },
  FUNDED:           { background: "#dbeafe", color: "#1e40af" },
  PROOF_SUBMITTED:  { background: "#ffedd5", color: "#9a3412" },
  PENDING_REVIEW:   { background: "#fef3c7", color: "#92400e" },
  VERIFIED:         { background: "#f3e8ff", color: "#6b21a8" },
  REJECTED:         { background: "#fee2e2", color: "#991b1b" },
  DECLINED:         { background: "#fee2e2", color: "#991b1b" },
  EXPIRED:          { background: "#f4f4f5", color: "#52525b" },
  COMPLETED:        { background: "#dcfce7", color: "#166534" },
};

interface Contract {
  id: string;
  milestone: string;
  amountUSD: string;
  status: string;
  investor: { walletAddress: string | null };
  createdAt: string;
}

function StartupDashboardContent() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite");
  const [joining, setJoining] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [preview, setPreview] = useState<{
    id: string; milestone: string; amountUSD: string; cancelAfter: string; investorWallet: string | null;
  } | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`/api/contracts/preview?invite=${inviteCode}`)
      .then((r) => r.json())
      .then((data) => { if (!data.error) setPreview(data); })
      .catch(() => {});
  }, [inviteCode]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingContracts(true);
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => setContracts(data.contracts ?? []))
      .catch(() => toast.error("Contracts konnten nicht geladen werden."))
      .finally(() => setLoadingContracts(false));
  }, [status]);

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

  async function handleDeclineContract() {
    if (!inviteCode) return;
    setDeclining(true);
    try {
      await fetch("/api/contracts/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      toast.success("Invitation declined.");
      window.location.href = "/dashboard/startup";
    } catch {
      toast.error("Failed to decline invitation.");
    } finally {
      setDeclining(false);
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
          <Link href="/profile">
            <Button variant="ghost" size="sm">Profil</Button>
          </Link>
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
          <div className="flex flex-col gap-3 p-5 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm font-semibold text-blue-800">Contract-Einladung</p>
            {preview ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Milestone</span>
                  <p className="text-sm text-blue-900 leading-relaxed">{preview.milestone}</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Betrag</span>
                    <strong className="text-blue-900">${Number(preview.amountUSD).toLocaleString()} RLUSD</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Frist</span>
                    <span className="text-blue-900">{new Date(preview.cancelAfter).toLocaleDateString("de-DE")}</span>
                  </div>
                  {preview.investorWallet && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Investor</span>
                      <code className="text-xs font-mono text-blue-900">{preview.investorWallet.slice(0, 10)}…</code>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-blue-700">Contract wird geladen…</p>
            )}
            <p className="text-xs text-blue-600">Verbinde deine Wallet um zu akzeptieren.</p>
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
              <div className="flex flex-col gap-2">
                <Button size="lg" onClick={handleJoinContract} disabled={joining}>
                  {joining ? "Joining…" : "Accept Contract Invitation"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleDeclineContract}
                  disabled={joining || declining}
                >
                  {declining ? "Declining…" : "Decline Invitation"}
                </Button>
              </div>
            )}

            {!inviteCode && (
              <div className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Meine Contracts</h2>

                {loadingContracts && (
                  <p className="text-sm text-muted-foreground">Laden…</p>
                )}

                {!loadingContracts && contracts.length === 0 && (
                  <div className="p-6 bg-white rounded-xl border text-center">
                    <p className="text-sm text-muted-foreground">
                      Noch keine Contracts. Warte auf einen Invite-Link vom Investor.
                    </p>
                  </div>
                )}

                {contracts.map((c) => {
                  const colors = STATUS_COLORS[c.status] ?? STATUS_COLORS.DRAFT;
                  return (
                    <Link key={c.id} href={`/contract/${c.id}?startup=${walletAddress}`}>
                      <div className="p-4 bg-white rounded-xl border hover:border-zinc-400 transition-colors cursor-pointer flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                            {c.milestone}
                          </p>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                            style={colors}
                          >
                            {STATUS_LABELS[c.status] ?? c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>
                            <strong className="text-zinc-800">${Number(c.amountUSD).toLocaleString()}</strong> RLUSD
                          </span>
                          <span>
                            Investor:{" "}
                            <code className="font-mono">{c.investor.walletAddress?.slice(0, 8)}…</code>
                          </span>
                          <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
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
