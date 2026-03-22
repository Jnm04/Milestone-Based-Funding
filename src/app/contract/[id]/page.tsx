import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EscrowStatus } from "@/components/escrow-status";
import { AIResult } from "@/components/ai-result";
import { ContractStatus } from "@/types";
import { ContractActions } from "./contract-actions";

interface ContractPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ investor?: string; startup?: string }>;
}

export default async function ContractPage({ params, searchParams }: ContractPageProps) {
  const { id } = await params;
  const { investor, startup } = await searchParams;
  const viewerWallet = investor ?? startup ?? null;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      investor: true,
      startup: true,
      proofs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!contract) notFound();

  const latestProof = contract.proofs[0] ?? null;
  const inviteUrl = contract.inviteLink
    ? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/startup?invite=${contract.inviteLink}`
    : null;

  return (
    <main className="min-h-screen bg-zinc-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">MilestoneFund</Link>
        <Badge variant="outline">Contract</Badge>
      </nav>

      <div className="max-w-2xl mx-auto py-10 px-6 flex flex-col gap-6">
        {/* Header */}
        <div>
          <Link href="/dashboard/investor" className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-3">Contract</h1>
          <code className="text-xs text-muted-foreground font-mono">{contract.id}</code>
        </div>

        {/* Milestone */}
        <div className="p-5 bg-white rounded-xl border flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Milestone</span>
          <p className="text-sm leading-relaxed">{contract.milestone}</p>
          <div className="flex items-center gap-4 pt-2 text-sm text-zinc-500">
            <span>
              Amount:{" "}
              <strong className="text-zinc-900">
                ${Number(contract.amountUSD).toLocaleString()} RLUSD
              </strong>
            </span>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Investor</span>
            <code className="text-xs font-mono break-all">{contract.investor.walletAddress}</code>
          </div>
          <div className="p-4 bg-white rounded-xl border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Startup</span>
            {contract.startup ? (
              <code className="text-xs font-mono break-all">{contract.startup.walletAddress}</code>
            ) : (
              <span className="text-xs text-muted-foreground italic">Awaiting acceptance</span>
            )}
          </div>
        </div>

        {/* Invite link */}
        {inviteUrl && contract.status === "DRAFT" && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-2">
            <span className="text-sm font-medium text-blue-700">Share with startup</span>
            <code className="text-xs font-mono break-all text-blue-600">{inviteUrl}</code>
          </div>
        )}

        {/* Escrow status */}
        <EscrowStatus
          status={contract.status as ContractStatus}
          escrowSequence={contract.escrowSequence}
          amountRLUSD={contract.amountRLUSD}
          cancelAfter={contract.cancelAfter}
        />

        {/* Interactive actions (client component) */}
        <ContractActions
          contractId={contract.id}
          status={contract.status as ContractStatus}
          investorAddress={contract.investor.walletAddress ?? ""}
          startupAddress={contract.startup?.walletAddress ?? null}
          escrowSequence={contract.escrowSequence}
          escrowCondition={contract.escrowCondition}
          amountRLUSD={contract.amountRLUSD ?? contract.amountUSD.toString()}
          cancelAfter={contract.cancelAfter.toISOString()}
          latestProofId={latestProof?.id ?? null}
          latestProofReasoning={latestProof?.aiReasoning ?? null}
          latestProofConfidence={latestProof?.aiConfidence ?? null}
          latestProofFileUrl={latestProof?.fileUrl ?? null}
          latestProofFileName={latestProof?.fileName ?? null}
          viewerWallet={viewerWallet}
        />

        {/* AI result */}
        {latestProof?.aiDecision && (
          <AIResult
            decision={latestProof.aiDecision}
            reasoning={latestProof.aiReasoning ?? ""}
            confidence={latestProof.aiConfidence ?? 0}
            submittedAt={latestProof.createdAt}
          />
        )}
      </div>
    </main>
  );
}
