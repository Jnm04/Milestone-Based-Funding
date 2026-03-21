"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ContractForm } from "@/components/contract-form";
import { Badge } from "@/components/ui/badge";

function NewContractContent() {
  const params = useSearchParams();
  const investorAddress = params.get("investor") ?? "";

  if (!investorAddress) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        No wallet connected. <Link href="/dashboard/investor" className="underline">Go back</Link>.
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-6 flex flex-col gap-6">
      <div>
        <Link href="/dashboard/investor" className="text-sm text-muted-foreground hover:underline">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mt-3">New Contract</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define the milestone and lock RLUSD for the startup.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm p-3 bg-zinc-50 rounded-lg border">
        <span className="text-zinc-500">Investor:</span>
        <code className="font-mono text-xs">{investorAddress}</code>
      </div>

      <div className="p-6 bg-white rounded-xl border">
        <ContractForm investorAddress={investorAddress} />
      </div>
    </div>
  );
}

export default function NewContractPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">MilestoneFund</Link>
        <Badge variant="outline">Investor</Badge>
      </nav>
      <Suspense>
        <NewContractContent />
      </Suspense>
    </main>
  );
}
