import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EscrowStatus } from "@/components/escrow-status";
import { AIResult } from "@/components/ai-result";
import { ContractStatus } from "@/types";
import { ContractActions } from "./contract-actions";
import { MilestoneTimeline } from "./milestone-timeline";
import { ContractPoller } from "./contract-poller";

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
      milestones: {
        orderBy: { order: "asc" },
        include: { proofs: { orderBy: { createdAt: "desc" } } },
      },
    },
  });

  if (!contract) return notFound();

  const latestProof = contract.proofs[0] ?? null;
  const inviteUrl = contract.inviteLink
    ? `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/startup?invite=${contract.inviteLink}`
    : null;

  // Determine dashboard link based on viewer role
  const isInvestorViewer = viewerWallet && viewerWallet === contract.investor.walletAddress;
  const dashboardHref = isInvestorViewer ? "/dashboard/investor" : "/dashboard/startup";

  // Find the active milestone:
  // - Prioritize AWAITING_ESCROW (investor needs to fund it)
  // - Then any other active state (FUNDED, PROOF_SUBMITTED, etc.)
  const activeMilestone = contract.milestones.length > 0
    ? (
        contract.milestones.find((m) => m.status === "AWAITING_ESCROW") ??
        contract.milestones.find((m) => !["PENDING", "COMPLETED", "AWAITING_ESCROW"].includes(m.status)) ??
        contract.milestones.find((m) => m.status === "FUNDED") ??
        null
      )
    : null;
  const activeMilestoneIndex = activeMilestone
    ? contract.milestones.findIndex((m) => m.id === activeMilestone.id)
    : -1;

  return (
    <main className="min-h-screen bg-zinc-50">
      <ContractPoller
        contractId={contract.id}
        currentStatus={contract.status}
        milestoneStatuses={contract.milestones.map((m) => m.status)}
      />
      <nav className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">Prova</Link>
        <Badge variant="outline">Contract</Badge>
      </nav>

      <div className="max-w-2xl mx-auto py-10 px-6 flex flex-col gap-6">
        {/* Header */}
        <div>
          <Link href={dashboardHref} className="text-sm text-muted-foreground hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-3">Contract</h1>
          <code className="text-xs text-muted-foreground font-mono">{contract.id}</code>
        </div>

        {/* Project overview */}
        <div className="p-5 bg-white rounded-xl border flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Project</span>
          <p className="text-sm leading-relaxed">{contract.milestone}</p>
          <div className="flex items-center gap-4 pt-2 text-sm text-zinc-500">
            <span>
              Total:{" "}
              <strong className="text-zinc-900">
                ${Number(contract.amountUSD).toLocaleString()} RLUSD
              </strong>
            </span>
            {contract.milestones.length > 0 && (
              <span className="text-zinc-400">
                {contract.milestones.length} milestone{contract.milestones.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Milestone timeline */}
        {contract.milestones.length > 0 && (
          <MilestoneTimeline
            milestones={contract.milestones.map((ms) => ({
              id: ms.id,
              title: ms.title,
              amountUSD: ms.amountUSD.toString(),
              cancelAfter: ms.cancelAfter.toISOString(),
              status: ms.status,
              order: ms.order,
              escrowSequence: ms.escrowSequence,
              proofs: ms.proofs.map((p) => ({
                id: p.id,
                fileName: p.fileName,
                fileUrl: p.fileUrl,
                aiDecision: p.aiDecision,
                aiReasoning: p.aiReasoning,
                aiConfidence: p.aiConfidence,
                createdAt: p.createdAt.toISOString(),
              })),
            }))}
            activeMilestoneId={activeMilestone?.id ?? null}
          />
        )}

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-xl border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Grant Giver</span>
            <code className="text-xs font-mono break-all">{contract.investor.walletAddress}</code>
          </div>
          <div className="p-4 bg-white rounded-xl border flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Receiver</span>
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
            <span className="text-sm font-medium text-blue-700">Share with receiver</span>
            <code className="text-xs font-mono break-all text-blue-600">{inviteUrl}</code>
          </div>
        )}

        {/* Escrow status */}
        <EscrowStatus
          status={contract.status as ContractStatus}
          evmTxHash={activeMilestone?.evmTxHash ?? contract.evmTxHash}
          amountRLUSD={activeMilestone?.amountRLUSD ?? contract.amountRLUSD}
          cancelAfter={activeMilestone?.cancelAfter ?? contract.cancelAfter}
        />

        {/* Interactive actions (client component) */}
        <ContractActions
          contractId={contract.id}
          status={contract.status as ContractStatus}
          investorAddress={contract.investor.walletAddress ?? ""}
          startupAddress={contract.startup?.walletAddress ?? null}
          amountRLUSD={
            activeMilestone?.amountRLUSD ??
            contract.amountRLUSD ??
            contract.amountUSD.toString()
          }
          cancelAfter={(activeMilestone?.cancelAfter ?? contract.cancelAfter).toISOString()}
          milestoneId={activeMilestone?.id ?? null}
          milestoneTitle={activeMilestone?.title ?? null}
          milestoneNumber={activeMilestoneIndex >= 0 ? activeMilestoneIndex + 1 : null}
          totalMilestones={contract.milestones.length}
          latestProofId={activeMilestone?.proofs[0]?.id ?? latestProof?.id ?? null}
          latestProofReasoning={activeMilestone?.proofs[0]?.aiReasoning ?? latestProof?.aiReasoning ?? null}
          latestProofConfidence={activeMilestone?.proofs[0]?.aiConfidence ?? latestProof?.aiConfidence ?? null}
          latestProofFileUrl={activeMilestone?.proofs[0]?.fileUrl ?? latestProof?.fileUrl ?? null}
          latestProofFileName={activeMilestone?.proofs[0]?.fileName ?? latestProof?.fileName ?? null}
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
