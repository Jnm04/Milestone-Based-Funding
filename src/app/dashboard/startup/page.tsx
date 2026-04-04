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
  DRAFT: "Draft",
  AWAITING_ESCROW: "Awaiting Escrow",
  FUNDED: "Funded",
  PROOF_SUBMITTED: "Proof Submitted",
  PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  DECLINED: "Invitation Declined",
  EXPIRED: "Expired",
  COMPLETED: "Completed",
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
  milestones: { status: string }[];
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
    id: string;
    milestone: string;
    amountUSD: string;
    cancelAfter: string;
    investorWallet: string | null;
    milestones: Array<{ id: string; title: string; amountUSD: string; cancelAfter: string; order: number }>;
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
    if (status === "authenticated" && session.user.role !== "STARTUP" && !inviteCode) router.push("/dashboard/investor");
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

  // Grant Giver opened an invite link — show a clear message instead of silently redirecting
  if (session.user.role !== "STARTUP" && inviteCode) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 flex flex-col gap-4 text-center">
          <p className="text-lg font-bold">Wrong account</p>
          <p className="text-sm text-muted-foreground">
            You&apos;re logged in as a <strong>Grant Giver</strong>. This invite link is for a <strong>Receiver</strong> account.
          </p>
          <p className="text-sm text-muted-foreground">
            Sign out and register or log in as a Receiver to accept this invitation.
          </p>
          <Button onClick={() => signOut({ callbackUrl: `/dashboard/startup?invite=${inviteCode}` })}>
            Sign out & switch account
          </Button>
          <Link href="/dashboard/investor" className="text-sm text-muted-foreground hover:underline">
            Back to my dashboard
          </Link>
        </div>
      </main>
    );
  }

  const walletAddress = session.user.walletAddress;

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
          <Badge variant="outline">Receiver</Badge>
          <Link href="/profile">
            <Button variant="ghost" size="sm">Profile</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Receiver Dashboard</h1>
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
            <p className="text-sm font-semibold text-blue-800">Contract Invitation</p>
            {preview ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Milestone</span>
                  <p className="text-sm text-blue-900 leading-relaxed">{preview.milestone}</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Amount</span>
                    <strong className="text-blue-900">${Number(preview.amountUSD).toLocaleString()} RLUSD</strong>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Deadline</span>
                    <span className="text-blue-900">{new Date(preview.cancelAfter).toLocaleDateString()}</span>
                  </div>
                  {preview.investorWallet && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Grant Giver</span>
                      <code className="text-xs font-mono text-blue-900">{preview.investorWallet.slice(0, 10)}…</code>
                    </div>
                  )}
                </div>
                {preview.milestones && preview.milestones.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-blue-600 uppercase tracking-wide font-medium">Milestones ({preview.milestones.length})</span>

                    <div className="flex flex-col gap-1.5">
                      {preview.milestones.map((ms, idx) => (
                        <div key={ms.id} className="flex items-start gap-2 p-2.5 bg-white/60 rounded-lg border border-blue-100">
                          <span style={{ flexShrink: 0, width: "20px", height: "20px", borderRadius: "50%", background: "#bfdbfe", color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-blue-900 leading-snug">{ms.title}</p>
                            <div className="flex gap-3 mt-0.5 text-xs text-blue-700">
                              <span><strong>${Number(ms.amountUSD).toLocaleString()}</strong> RLUSD</span>
                              <span>bis {new Date(ms.cancelAfter).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-blue-700">Loading contract…</p>
            )}
            <p className="text-xs text-blue-600">Connect your wallet to accept.</p>
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
                <h2 className="text-base font-semibold">My Contracts</h2>

                {loadingContracts && (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}

                {!loadingContracts && contracts.length === 0 && (
                  <div className="p-6 bg-white rounded-xl border text-center">
                    <p className="text-sm text-muted-foreground">
                      No contracts yet. Wait for an invite link from your Grant Giver.
                    </p>
                  </div>
                )}

                {contracts.map((c) => {
                  const colors = STATUS_COLORS[c.status] ?? STATUS_COLORS.DRAFT;
                  const totalMs = c.milestones.length;
                  const completedMs = c.milestones.filter((m) => m.status === "COMPLETED").length;
                  const showProgress = totalMs > 1;
                  return (
                    <Link key={c.id} href={`/contract/${c.id}?startup=${walletAddress}`}>
                      <div className="p-4 bg-white rounded-xl border hover:border-zinc-400 transition-colors cursor-pointer flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">
                            {c.milestone}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            {showProgress && (
                              <span className="text-xs text-zinc-500">
                                {completedMs}/{totalMs} milestones
                              </span>
                            )}
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={colors}
                            >
                              {STATUS_LABELS[c.status] ?? c.status}
                            </span>
                          </div>
                        </div>
                        {showProgress && (
                          <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(completedMs / totalMs) * 100}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>
                            <strong className="text-zinc-800">${Number(c.amountUSD).toLocaleString()}</strong> RLUSD
                          </span>
                          <span>
                            Grant Giver:{" "}
                            <code className="font-mono">{c.investor.walletAddress?.slice(0, 8)}…</code>
                          </span>
                          <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
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
