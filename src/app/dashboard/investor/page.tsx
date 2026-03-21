"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function InvestorDashboard() {
  const [address, setAddress] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">MilestoneFund</Link>
        <Badge variant="outline">Investor</Badge>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Investor Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Connect your wallet to create contracts and lock RLUSD in escrow.
          </p>
        </div>

        {!address ? (
          <div className="flex flex-col gap-4 p-6 bg-white rounded-xl border">
            <p className="text-sm font-medium">Step 1: Connect your XRPL wallet</p>
            <WalletConnect role="INVESTOR" onConnected={setAddress} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Connected wallet</p>
                <code className="text-sm font-mono">{address}</code>
              </div>
              <Badge className="bg-green-100 text-green-700 border-green-200">Connected</Badge>
            </div>

            <Link href={`/contract/new?investor=${address}`}>
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
