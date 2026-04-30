/**
 * POST /api/mcp/submit
 * MCP Verification Endpoint — Model Context Protocol compatible.
 *
 * Allows external AI agents to submit milestone evidence and trigger
 * Cascrow's 5-model verification pipeline programmatically.
 *
 * Auth: API key (Bearer csk_...) via existing resolveApiKey() infrastructure.
 *
 * Input:
 *   { contract_id, milestone_id, mode: "escrow"|"enterprise", evidence: { description, links?, github_commit?, revenue_amount?, custom_fields? } }
 *
 * Output:
 *   { verdict: "approved"|"rejected"|"pending_review", confidence: number, on_chain_url: string|null, signed_at: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyMilestone } from "@/services/ai/verifier.service";
import { writeAuditLog } from "@/services/evm/audit.service";
import { releaseMilestone, contractIdToBytes32 } from "@/services/evm/escrow.service";
import { decryptFulfillment } from "@/lib/crypto";
import { mintCompletionNFT } from "@/services/xrpl/nft.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { sendVerifiedEmail, sendFulfillmentKeyEmail, sendMilestoneCompletedInvestorEmail } from "@/lib/email";
import crypto from "crypto";

export const maxDuration = 60;

interface MCPEvidence {
  description: string;
  links?: string[];
  github_commit?: string;
  revenue_amount?: number;
  custom_fields?: Record<string, unknown>;
}

interface MCPSubmitBody {
  contract_id: string;
  milestone_id?: string;
  mode?: "escrow" | "enterprise";
  evidence: MCPEvidence;
}

function buildExtractedText(evidence: MCPEvidence): string {
  const lines: string[] = ["=== MCP Agent Submission ===", ""];
  lines.push(`Description: ${evidence.description}`);
  if (evidence.links?.length) lines.push(`Links:\n${evidence.links.map((l) => `  - ${l}`).join("\n")}`);
  if (evidence.github_commit) lines.push(`GitHub commit: ${evidence.github_commit}`);
  if (evidence.revenue_amount !== undefined) lines.push(`Revenue amount: $${evidence.revenue_amount.toLocaleString()}`);
  if (evidence.custom_fields && Object.keys(evidence.custom_fields).length > 0) {
    lines.push("Custom fields:");
    for (const [k, v] of Object.entries(evidence.custom_fields)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

function generatePublicProofHash(contractId: string, milestoneId: string, verifiedAt: Date): string {
  return crypto
    .createHash("sha256")
    .update(`${contractId}:${milestoneId}:${verifiedAt.toISOString()}`)
    .digest("hex");
}

async function autoMintNft(params: {
  contractId: string;
  milestoneId?: string;
  milestoneTitle: string;
  amountUSD: string;
  evmTxHash?: string;
}): Promise<void> {
  const { contractId, milestoneId, milestoneTitle, amountUSD, evmTxHash } = params;

  const claimed = milestoneId
    ? await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: null }, data: { nftTokenId: "PENDING" } })
    : await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: null }, data: { nftTokenId: "PENDING" } });

  if (claimed.count === 0) return;

  try {
    const nft = await mintCompletionNFT({ contractId, milestoneTitle, amountUSD, completedAt: new Date(), evmTxHash });
    if (milestoneId) {
      await prisma.milestone.update({ where: { id: milestoneId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash ?? null, nftImageUrl: nft.imageUrl ?? null } });
    } else {
      await prisma.contract.update({ where: { id: contractId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash ?? null, nftImageUrl: nft.imageUrl ?? null } });
    }
    await writeAuditLog({ contractId, milestoneId, event: "NFT_MINTED", metadata: { tokenId: nft.tokenId, txHash: nft.txHash, auto: true, via: "mcp" } });
  } catch (err) {
    if (milestoneId) {
      await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    } else {
      await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get("authorization");
  const apiKeyContext = await resolveApiKey(authHeader);
  if (!apiKeyContext) {
    return NextResponse.json({ error: "Unauthorized — provide a valid API key as Bearer token" }, { status: 401 });
  }

  // Rate limit: 20 MCP submissions per user per hour
  const withinLimit = await checkRateLimit(`mcp-submit:${apiKeyContext.userId}`, 20, 60 * 60 * 1000);
  if (!withinLimit) {
    return NextResponse.json({ error: "Rate limit exceeded — max 20 submissions per hour" }, { status: 429 });
  }

  let body: MCPSubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contract_id, milestone_id, evidence } = body;

  if (!contract_id) return NextResponse.json({ error: "contract_id is required" }, { status: 400 });
  if (!evidence?.description) return NextResponse.json({ error: "evidence.description is required" }, { status: 400 });

  // Load contract with all data needed for release
  const contract = await prisma.contract.findUnique({
    where: { id: contract_id },
    include: {
      milestones: { orderBy: { order: "asc" } },
      investor: true,
      startup: true,
    },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Auth: caller must be investor or startup of this contract
  const isParty = contract.investorId === apiKeyContext.userId || contract.startupId === apiKeyContext.userId;
  if (!isParty) return NextResponse.json({ error: "Forbidden — you are not a party to this contract" }, { status: 403 });

  // Find milestone
  const milestone = milestone_id
    ? contract.milestones.find((m) => m.id === milestone_id)
    : contract.milestones.find((m) => !["COMPLETED", "EXPIRED"].includes(m.status));

  if (!milestone) return NextResponse.json({ error: "Milestone not found or no active milestone" }, { status: 404 });

  const milestoneTitle = milestone.title;
  const amountUSD = (milestone.amountUSD ?? contract.amountUSD).toString();
  const extractedText = buildExtractedText(evidence);

  // Run 5-model verification
  let verifyResult;
  try {
    verifyResult = await verifyMilestone({
      milestone: milestoneTitle,
      extractedText,
      verificationCriteria: milestone.verificationCriteria ?? null,
    });
  } catch (err) {
    console.error("[mcp/submit] Verification failed:", err);
    return NextResponse.json({ error: "Verification service unavailable" }, { status: 503 });
  }

  // Determine verdict
  let verdict: "approved" | "rejected" | "pending_review";
  if (verifyResult.confidence < 60) {
    verdict = "rejected";
  } else if (verifyResult.confidence <= 85) {
    verdict = "pending_review";
  } else if (verifyResult.decision === "YES") {
    verdict = "approved";
  } else {
    verdict = "rejected";
  }

  // Create proof record
  const proof = await prisma.proof.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone.id,
      fileUrl: `mcp://agent-submission/${Date.now()}`,
      fileName: "mcp-agent-submission.txt",
      extractedText,
      proofType: "mcp_agent",
      aiDecision: verifyResult.decision,
      aiReasoning: verifyResult.reasoning,
      aiConfidence: verifyResult.confidence,
      aiModelVotes: verifyResult.modelVotes as never,
    },
  });

  // Write audit log
  await writeAuditLog({
    contractId: contract.id,
    milestoneId: milestone.id,
    event: "MCP_SUBMISSION",
    actor: `api_key:${apiKeyContext.keyId}`,
    metadata: { verdict, confidence: verifyResult.confidence, proofId: proof.id },
  });

  let onChainUrl: string | null = null;
  let txHash: string | undefined;

  if (verdict === "approved") {
    // ── Full release flow: same as /api/verify ──────────────────────────────
    try {
      const milestoneOrder = milestone.order ?? 0;
      const rawFulfillment = milestone.escrowFulfillment ?? contract.escrowFulfillment;
      if (!rawFulfillment) throw new Error("Fulfillment key not found");
      const fulfillment = decryptFulfillment(rawFulfillment);

      // Email startup the fulfillment key (they can also self-release)
      if (contract.startup?.email) {
        sendFulfillmentKeyEmail({
          to: contract.startup.email,
          contractId: contract.id,
          milestoneTitle,
          fulfillment,
          contractIdHash: contractIdToBytes32(contract.id),
          milestoneOrder,
        }).catch((err) => console.error("[mcp] sendFulfillmentKeyEmail failed:", err));
      }

      txHash = await releaseMilestone(contract.id, milestoneOrder, fulfillment);
      console.log("[mcp/submit] Auto-released on-chain:", txHash);

      // Update milestone + contract status
      const completedMilestone = await prisma.milestone.update({
        where: { id: milestone.id },
        data: { status: "COMPLETED", evmTxHash: txHash, escrowFulfillment: null },
        include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
      });
      const milestones = completedMilestone.contract.milestones;
      const remaining = milestones.find((m) => m.id !== milestone.id && !["COMPLETED", "EXPIRED"].includes(m.status));
      const nextContractStatus = !remaining ? "COMPLETED" : remaining.status === "FUNDED" ? "FUNDED" : "AWAITING_ESCROW";
      await prisma.contract.update({ where: { id: contract.id }, data: { status: nextContractStatus as never } });

      await writeAuditLog({
        contractId: contract.id,
        milestoneId: milestone.id,
        event: "FUNDS_RELEASED",
        metadata: { txHash, amountUSD, auto: true, via: "mcp" },
      });

      // Generate public proof page
      const proofHash = generatePublicProofHash(contract.id, milestone.id, new Date());
      const baseUrl = process.env.NEXTAUTH_URL ?? "https://cascrow.xyz";
      const publicUrl = `${baseUrl}/proof/${proofHash}`;
      onChainUrl = publicUrl;
      void prisma.milestone.update({
        where: { id: milestone.id },
        data: { publicProofHash: proofHash, publicProofGeneratedAt: new Date() },
      }).then(async () => {
        if (contract.startup?.email && contract.investor?.email) {
          const { sendPublicProofReadyEmail } = await import("@/lib/email");
          void sendPublicProofReadyEmail({
            toInvestor: contract.investor.email,
            toStartup: contract.startup.email,
            contractId: contract.id,
            milestoneTitle,
            publicUrl,
          }).catch(() => {});
        }
      }).catch(() => {});

      // Fire webhooks
      fireWebhook({
        investorId: contract.investorId,
        startupId: contract.startupId,
        event: "funds.released",
        contractId: contract.id,
        milestoneId: milestone.id,
        data: { txHash, amountUSD, milestoneTitle, auto: true, via: "mcp" },
      }).catch((err) => console.error("[mcp] funds.released webhook failed:", err));

      // Send emails
      if (contract.startup?.notifyVerified && contract.startup?.email) {
        sendVerifiedEmail({ to: contract.startup.email, contractId: contract.id, milestoneTitle, amountUSD, txHash, startupId: contract.startupId ?? undefined })
          .catch((err) => console.error("[mcp] sendVerifiedEmail failed:", err));
      }
      if (contract.investor?.notifyMilestoneCompleted) {
        sendMilestoneCompletedInvestorEmail({ to: contract.investor.email, contractId: contract.id, milestoneTitle, amountUSD, investorId: contract.investorId })
          .catch((err) => console.error("[mcp] sendMilestoneCompletedInvestorEmail failed:", err));
      }

      // Auto-mint NFT certificate
      void autoMintNft({
        contractId: contract.id,
        milestoneId: milestone.id,
        milestoneTitle,
        amountUSD,
        evmTxHash: txHash,
      }).catch((err) => console.warn("[mcp] auto-nft mint failed (non-fatal):", err));

    } catch (releaseErr) {
      const errMsg = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
      console.error("[mcp/submit] Auto-release failed:", errMsg);

      // Attestation mode: no escrow — mark COMPLETED directly
      if (contract.mode === "ATTESTATION") {
        const completedMs = await prisma.milestone.update({
          where: { id: milestone.id },
          data: { status: "COMPLETED" },
          include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
        });
        const remaining = completedMs.contract.milestones.find(
          (m) => m.id !== milestone.id && !["COMPLETED", "EXPIRED"].includes(m.status)
        );
        await prisma.contract.update({ where: { id: contract.id }, data: { status: remaining ? "FUNDED" : "COMPLETED" } });
      } else {
        // Escrow release failed — mark VERIFIED so admin/startup can manually trigger
        await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "VERIFIED" as never } });
        await prisma.contract.update({ where: { id: contract.id }, data: { status: "VERIFIED" as never } });
        await writeAuditLog({
          contractId: contract.id,
          milestoneId: milestone.id,
          event: "FUNDS_RELEASED",
          actor: "SYSTEM",
          metadata: { error: errMsg, auto: true, failed: true, via: "mcp" },
        });
      }
    }
  } else if (verdict === "rejected") {
    await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "REJECTED" as never } });
    await prisma.contract.update({ where: { id: contract.id }, data: { status: "REJECTED" as never } });
  } else {
    // pending_review
    await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "PENDING_REVIEW" as never } });
    await prisma.contract.update({ where: { id: contract.id }, data: { status: "PENDING_REVIEW" as never } });
  }

  return NextResponse.json({
    verdict,
    confidence: verifyResult.confidence,
    reasoning: verifyResult.reasoning,
    model_votes: verifyResult.modelVotes,
    on_chain_url: onChainUrl,
    proof_id: proof.id,
    signed_at: new Date().toISOString(),
  });
}
