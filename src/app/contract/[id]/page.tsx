export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EscrowStatus } from "@/components/escrow-status";
import { AIResult } from "@/components/ai-result";
import { AuditTrail } from "@/components/audit-trail";
import { ContractStatus } from "@/types";
import { ContractActions } from "./contract-actions";
import type { ProofGuidanceData } from "@/components/proof-guidance";
import { CredibilityPanel, type CredibilityScoreData } from "@/components/credibility-panel";
import { MilestoneTimeline } from "./milestone-timeline";
import { ContractPoller } from "./contract-poller";
import { NodeBackground } from "@/components/node-background";
import { NftSection } from "@/components/nft-section";
import { IS_MAINNET } from "@/lib/config";
import { CalendarButton } from "@/components/calendar-button";
import { CopyButton } from "@/components/copy-button";

interface ContractPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ investor?: string; startup?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { milestone: true },
  });
  return {
    title: contract ? `${contract.milestone} | cascrow` : "Contract | cascrow",
  };
}


export default async function ContractPage({ params, searchParams }: ContractPageProps) {
  const { id } = await params;
  const { investor, startup } = await searchParams;
  const viewerWallet = investor ?? startup ?? null;

  const [contract, auditLogs] = await Promise.all([
    prisma.contract.findUnique({
      where: { id },
      include: {
        investor: true,
        startup: true,
        proofs: { orderBy: { createdAt: "desc" } },
        milestones: {
          orderBy: { order: "asc" },
          include: { proofs: { orderBy: { createdAt: "desc" } } },
          // proofGuidance and proofGuidanceCachedAt are scalar fields — included automatically
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { contractId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!contract) return notFound();

  // Determine viewer role early so we can conditionally fetch credibility
  const isInvestorViewerEarly =
    viewerWallet && viewerWallet === contract.investor.walletAddress;

  // Fetch cached credibility score for the investor (if startup has accepted)
  const credibilityRecord =
    isInvestorViewerEarly && contract.startup
      ? await prisma.credibilityScore.findUnique({
          where: {
            startupId_contractId: {
              startupId: contract.startup.id,
              contractId: contract.id,
            },
          },
          select: {
            score: true,
            tier: true,
            signals: true,
            summary: true,
            cachedAt: true,
          },
        })
      : null;

  const latestProof = contract.proofs[0] ?? null;
  const inviteUrl = contract.inviteLink
    ? `${process.env.NEXTAUTH_URL ?? "https://cascrow.com"}/dashboard/startup?invite=${contract.inviteLink}`
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
    <main className="min-h-screen" style={{ background: "#171311", color: "#EDE6DD" }}>
      <NodeBackground />
      <ContractPoller
        contractId={contract.id}
        currentStatus={contract.status}
        milestoneStatuses={contract.milestones.map((m) => m.status)}
        hasNft={!!(
          contract.nftTokenId ||
          contract.milestones.some((m) => m.nftTokenId)
        )}
      />

      {/* Nav */}
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          background: "rgba(23,19,17,0.92)",
          backdropFilter: "blur(20px)",
          borderBottomColor: "rgba(196,112,75,0.12)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B" }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.55, marginLeft: 4 }} />
              <div style={{ width: 20, height: 3, borderRadius: 2, background: "#C4704B", opacity: 0.22, marginLeft: 8 }} />
            </div>
            <span style={{ fontFamily: "var(--font-libre-franklin), sans-serif", fontWeight: 300, fontSize: 16, color: "#EDE6DD", letterSpacing: "4px" }}>cascrow</span>
          </Link>
          <span
            className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest"
            style={{ background: "rgba(196,112,75,0.1)", border: "1px solid rgba(196,112,75,0.25)", color: "#C4704B" }}
          >
            Contract
          </span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto py-10 px-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <Link
            href={dashboardHref}
            className="text-xs uppercase tracking-widest font-medium"
            style={{ color: "#C4704B" }}
          >
            ← Dashboard
          </Link>
          <h1
            className="mt-2 tracking-tight"
            style={{ fontFamily: "var(--font-libre-franklin), sans-serif", fontWeight: 300, fontSize: "clamp(24px, 4vw, 32px)", color: "#EDE6DD" }}
          >
            Contract
          </h1>
          <span className="flex items-center gap-1.5">
            <code className="text-xs font-mono" style={{ color: "#A89B8C" }}>{contract.id}</code>
            <CopyButton text={contract.id} />
          </span>
        </div>

        {/* Project overview */}
        <div
          className="p-5 rounded-2xl flex flex-col gap-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(196,112,75,0.15)",
            borderTop: "1px solid #C4704B",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#C4704B" }}>Project</span>
            <CalendarButton contractId={contract.id} />
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "#EDE6DD" }}>{contract.milestone}</p>
          <div className="flex items-center gap-4 pt-1 text-sm" style={{ color: "#A89B8C" }}>
            <span>
              Total:{" "}
              <strong style={{ color: "#D4B896" }}>
                ${Number(contract.amountUSD).toLocaleString()} RLUSD
              </strong>
            </span>
            {contract.milestones.length > 0 && (
              <span>
                {contract.milestones.length} milestone{contract.milestones.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* AI Risk Flags */}
        {Array.isArray(contract.riskFlags) && (contract.riskFlags as unknown[]).length > 0 && (
          <details
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(196,112,75,0.2)",
              borderTop: "1px solid rgba(212,160,60,0.5)",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                padding: "14px 20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                listStyle: "none",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(212,160,60,0.12)",
                  color: "#D4A03C",
                  border: "1px solid rgba(212,160,60,0.3)",
                  flexShrink: 0,
                }}
              >
                AI
              </span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#EDE6DD", flex: 1 }}>
                Contract Risk Review
              </span>
              <span style={{ fontSize: "12px", color: "#A89B8C" }}>
                {(contract.riskFlags as Array<{ severity: string }>).filter((f) => f.severity === "WARNING").length > 0
                  ? `${(contract.riskFlags as Array<{ severity: string }>).filter((f) => f.severity === "WARNING").length} warning${(contract.riskFlags as Array<{ severity: string }>).filter((f) => f.severity === "WARNING").length !== 1 ? "s" : ""}`
                  : "advisory notes"}
              </span>
            </summary>
            <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(contract.riskFlags as Array<{ severity: string; text: string }>).map((flag, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: flag.severity === "WARNING"
                      ? "rgba(212,160,60,0.07)"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${flag.severity === "WARNING" ? "rgba(212,160,60,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: "1px", fontSize: "13px" }}>
                    {flag.severity === "WARNING" ? "⚠" : "ℹ"}
                  </span>
                  <span style={{ fontSize: "13px", color: "#EDE6DD", lineHeight: 1.5 }}>{flag.text}</span>
                </div>
              ))}
            </div>
          </details>
        )}

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
                fileHash: p.fileHash,
                aiDecision: p.aiDecision,
                aiReasoning: p.aiReasoning,
                aiConfidence: p.aiConfidence,
                aiModelVotes: p.aiModelVotes as import("@/components/ai-result").ModelVote[] | null,
                createdAt: p.createdAt.toISOString(),
              })),
            }))}
            activeMilestoneId={activeMilestone?.id ?? null}
          />
        )}

        {/* Parties */}
        <div className="grid grid-cols-2 gap-4">
          <div
            className="p-4 rounded-2xl flex flex-col gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)" }}
          >
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#A89B8C" }}>Grant Giver</span>
            <code className="text-xs font-mono break-all" style={{ color: "#EDE6DD" }}>{contract.investor.walletAddress}</code>
          </div>
          <div
            className="p-4 rounded-2xl flex flex-col gap-1.5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.12)" }}
          >
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#A89B8C" }}>Receiver</span>
            {contract.startup ? (
              <code className="text-xs font-mono break-all" style={{ color: "#EDE6DD" }}>{contract.startup.walletAddress}</code>
            ) : (
              <span className="text-xs italic" style={{ color: "#A89B8C" }}>Awaiting acceptance</span>
            )}
          </div>
        </div>

        {/* Invite link */}
        {inviteUrl && contract.status === "DRAFT" && (
          <div
            className="p-4 rounded-2xl flex flex-col gap-2"
            style={{ background: "rgba(212,184,150,0.06)", border: "1px solid rgba(212,184,150,0.2)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: "#D4B896" }}>Share with receiver</span>
              <CopyButton text={inviteUrl} />
            </div>
            <code className="text-xs font-mono break-all" style={{ color: "#A89B8C" }}>{inviteUrl}</code>
          </div>
        )}

        {/* Escrow status */}
        <EscrowStatus
          status={contract.status as ContractStatus}
          evmTxHash={activeMilestone?.evmTxHash ?? contract.evmTxHash}
          amountRLUSD={activeMilestone?.amountRLUSD ?? contract.amountRLUSD}
          cancelAfter={activeMilestone?.cancelAfter ?? contract.cancelAfter}
        />

        {/* On-chain audit trail */}
        <AuditTrail logs={auditLogs} />

        {/* AI Credibility Score — investor-only, shown when startup has accepted */}
        {isInvestorViewerEarly && contract.startup && (
          <CredibilityPanel
            contractId={contract.id}
            startupName={contract.startup.name ?? contract.startup.companyName ?? null}
            initialScore={
              credibilityRecord
                ? ({
                    score: credibilityRecord.score,
                    tier: credibilityRecord.tier as "HIGH" | "MEDIUM" | "LOW",
                    signals: credibilityRecord.signals as unknown as CredibilityScoreData["signals"],
                    summary: credibilityRecord.summary,
                    cachedAt: credibilityRecord.cachedAt.toISOString(),
                  } satisfies CredibilityScoreData)
                : null
            }
            defaultCollapsed={
              !["AWAITING_ESCROW"].includes(contract.status)
            }
          />
        )}

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
          milestoneGuidance={
            (activeMilestone?.proofGuidance as ProofGuidanceData | null) ?? null
          }
          latestProofAiObjections={
            ((activeMilestone?.proofs[0]?.aiObjections ?? latestProof?.aiObjections) as Array<{ code: string; description: string }> | null) ?? null
          }
          latestProofAppealStatus={activeMilestone?.proofs[0]?.appealStatus ?? latestProof?.appealStatus ?? null}
          latestProofAppealResult={activeMilestone?.proofs[0]?.appealResult ?? latestProof?.appealResult ?? null}
          latestProofAppealReasoning={activeMilestone?.proofs[0]?.appealReasoning ?? latestProof?.appealReasoning ?? null}
        />

        {/* AI result */}
        {latestProof?.aiDecision && (
          <AIResult
            decision={latestProof.aiDecision}
            reasoning={latestProof.aiReasoning ?? ""}
            confidence={latestProof.aiConfidence ?? 0}
            submittedAt={latestProof.createdAt}
            modelVotes={(latestProof.aiModelVotes as import("@/components/ai-result").ModelVote[] | null) ?? undefined}
          fileHash={latestProof.fileHash ?? undefined}
          />
        )}

        {/* XRPL Completion Certificates */}
        {(() => {
          const isCompleted = contract.status === "COMPLETED" ||
            contract.milestones.some((m) => m.status === "COMPLETED");

          const isMainnet = IS_MAINNET;
          const certs: Array<{
            tokenId: string; txHash: string; title: string;
            amountUSD: string; completedAt: string; imageUrl?: string;
          }> = [];

          if (contract.milestones.length > 0) {
            for (const ms of contract.milestones) {
              if (ms.nftTokenId && ms.nftTxHash) {
                certs.push({
                  tokenId: ms.nftTokenId, txHash: ms.nftTxHash,
                  title: ms.title, amountUSD: ms.amountUSD.toString(),
                  completedAt: ms.updatedAt.toISOString(),
                  imageUrl: ms.nftImageUrl ?? undefined,
                });
              }
            }
          } else if (contract.nftTokenId && contract.nftTxHash) {
            certs.push({
              tokenId: contract.nftTokenId, txHash: contract.nftTxHash,
              title: contract.milestone, amountUSD: contract.amountUSD.toString(),
              completedAt: contract.updatedAt.toISOString(),
              imageUrl: contract.nftImageUrl ?? undefined,
            });
          }

          if (!isCompleted && certs.length === 0) return null;

          const completedMilestone = contract.milestones.find(
            (m) => m.status === "COMPLETED" && !m.nftTokenId
          );

          return (
            <NftSection
              contractId={contract.id}
              milestoneId={completedMilestone?.id ?? null}
              certs={certs}
              isCompleted={isCompleted}
              isMainnet={isMainnet}
            />
          );
        })()}
      </div>
    </main>
  );
}
