"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  startup: { walletAddress: string | null } | null;
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
      .catch(() => toast.error("Contracts konnten nicht geladen werden."))
      .finally(() => setLoadingContracts(false));
  }, [status]);


  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Laden…</div>;
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
          <h1 className="text-2xl font-bold">Investor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {walletAddress ? "Deine Contracts im Überblick." : "Verbinde deine MetaMask Wallet um Contracts zu erstellen."}
          </p>
        </div>

        {!walletAddress ? (
          <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border">
            <p className="text-sm font-medium">EVM Wallet verbinden</p>
            <p className="text-xs text-muted-foreground">Trage deine MetaMask-Adresse (0x…) im Profil ein.</p>
            <Link href="/profile">
              <Button variant="outline" className="w-full">Zum Profil →</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">EVM Wallet (MetaMask)</p>
                <code className="text-sm font-mono break-all">{walletAddress}</code>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200">Verbunden</Badge>
            </div>

            <Link href={`/contract/new?investor=${walletAddress}`}>
              <Button size="lg" className="w-full">+ Neuen Contract erstellen</Button>
            </Link>

            <div className="flex flex-col gap-3">
              <h2 className="text-base font-semibold">Meine Contracts</h2>

              {loadingContracts && (
                <p className="text-sm text-muted-foreground">Laden…</p>
              )}

              {!loadingContracts && contracts.length === 0 && (
                <div className="p-6 bg-white rounded-xl border text-center">
                  <p className="text-sm text-muted-foreground">Noch keine Contracts erstellt.</p>
                </div>
              )}

              {contracts.map((c) => {
                const colors = STATUS_COLORS[c.status] ?? STATUS_COLORS.DRAFT;
                return (
                  <Link key={c.id} href={`/contract/${c.id}?investor=${walletAddress}`}>
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
                          Startup:{" "}
                          {c.startup?.walletAddress
                            ? <code className="font-mono">{c.startup.walletAddress.slice(0, 8)}…</code>
                            : <span className="italic">noch nicht akzeptiert</span>}
                        </span>
                        <span className="ml-auto">{new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
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
