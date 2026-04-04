"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BuyRlusdModal } from "@/components/buy-rlusd-modal";

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
  startup: { walletAddress: string | null } | null;
  milestones: { status: string }[];
  createdAt: string;
}

export default function InvestorDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session.user.role !== "INVESTOR") router.push("/dashboard/startup");
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingContracts(true);
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => setContracts(data.contracts ?? []))
      .catch(() => toast.error("Could not load contracts."))
      .finally(() => setLoadingContracts(false));
  }, [status]);


  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!session) return null;

  const walletAddress = session.user.walletAddress;

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">Cascrow</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.email}</span>
          <Badge variant="outline">Grant Giver</Badge>
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
          <h1 className="text-2xl font-bold">Grant Giver Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {walletAddress ? "Your contracts overview." : "Connect your MetaMask wallet to create contracts."}
          </p>
        </div>

        {!walletAddress ? (
          <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border">
            <p className="text-sm font-medium">Connect EVM Wallet</p>
            <p className="text-xs text-muted-foreground">Add your MetaMask address (0x…) in your profile.</p>
            <Link href="/profile">
              <Button variant="outline" className="w-full">Go to Profile →</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">EVM Wallet (MetaMask)</p>
                <code className="text-sm font-mono break-all">{walletAddress}</code>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
            </div>

            <div className="flex flex-col gap-2">
              <Link href={`/contract/new?investor=${walletAddress}`}>
                <Button size="lg" className="w-full">+ Create New Contract</Button>
              </Link>
              <BuyRlusdModal walletAddress={walletAddress} />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">My Contracts</h2>

              {loadingContracts && (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}

              {!loadingContracts && contracts.length === 0 && (
                <div className="p-6 bg-white rounded-xl border text-center">
                  <p className="text-sm text-muted-foreground">No contracts created yet.</p>
                </div>
              )}

              {contracts.map((c) => {
                const colors = STATUS_COLORS[c.status] ?? STATUS_COLORS.DRAFT;
                const totalMs = c.milestones.length;
                const completedMs = c.milestones.filter((m) => m.status === "COMPLETED").length;
                const showProgress = totalMs > 1;
                return (
                  <Link key={c.id} href={`/contract/${c.id}?investor=${walletAddress}`}>
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
                          Receiver:{" "}
                          {c.startup?.walletAddress
                            ? <code className="font-mono">{c.startup.walletAddress.slice(0, 8)}…</code>
                            : <span className="italic">not yet accepted</span>}
                        </span>
                        <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
