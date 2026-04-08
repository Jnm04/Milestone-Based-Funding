import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyMilestone, verifyMilestoneImage, mockVerifyMilestone, categorizeFile, VERIFICATION_PROMPT_HASH } from "@/services/ai/verifier.service";
import { storeBrainData } from "@/services/brain/training.service";
import { releaseMilestone } from "@/services/evm/escrow.service";
import { sendPendingReviewEmail, sendRejectedEmail, sendVerifiedEmail, sendMilestoneCompletedInvestorEmail, sendFulfillmentKeyEmail } from "@/lib/email";
import { contractIdToBytes32 } from "@/services/evm/escrow.service";
import { writeAuditLog } from "@/services/evm/audit.service";

// Allow up to 60s — XRPL WebSocket + NFT mint can take 10-20s (requires Vercel Pro for >10s)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Accept either an internal server call (CRON_SECRET) or a logged-in session
    const authHeader = request.headers.get("authorization");
    const isInternalCall = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    if (!isInternalCall) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { proofId } = await request.json();

    if (!proofId) {
      return NextResponse.json({ error: "proofId is required" }, { status: 400 });
    }

    // Load proof + contract + milestone
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        contract: { include: { investor: true, startup: true } },
        milestone: true,
      },
    });

    if (!proof) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }

    const { contract } = proof;

    if (!["PROOF_SUBMITTED", "PENDING_REVIEW"].includes(contract.status)) {
      return NextResponse.json(
        { error: `Contract is in status ${contract.status}, expected PROOF_SUBMITTED or PENDING_REVIEW` },
        { status: 409 }
      );
    }

    // Use milestone title for verification if available, otherwise contract milestone
    const milestoneTitle = proof.milestone?.title ?? contract.milestone;

    // Run AI verification
    const extractedText = proof.extractedText ?? "";
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-...";
    const category = categorizeFile("", proof.fileName);

    let result;
    if (!hasApiKey) {
      result = mockVerifyMilestone({ milestone: milestoneTitle, extractedText });
    } else if (category === "image") {
      // Fetch image from Vercel Blob — private blobs require the token as Bearer auth
      const imageRes = await fetch(proof.fileUrl, {
        headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      });
      if (!imageRes.ok) {
        throw new Error(`Failed to download image from storage: ${imageRes.status} ${imageRes.statusText}`);
      }
      const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
      const ext = proof.fileName.slice(proof.fileName.lastIndexOf(".")).toLowerCase();
      const mimeMap: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
      };
      const mimeType = mimeMap[ext] ?? "image/jpeg";
      try {
        result = await verifyMilestoneImage({ milestone: milestoneTitle, imageBuffer, mimeType });
      } catch (imgErr) {
        // Gemini sometimes rejects images (format, size, transient error) — fall back to Claude-only
        console.warn("[verify] Image verification failed, falling back to Claude-only:", imgErr);
        const { callClaudeImageOnly } = await import("@/services/ai/verifier.service");
        result = await callClaudeImageOnly({ milestone: milestoneTitle, imageBuffer, mimeType });
      }
    } else {
      result = await verifyMilestone({
        milestone: milestoneTitle,
        extractedText: extractedText || "(No text could be extracted from this document.)",
      });
    }

    // Persist AI result on proof
    await prisma.proof.update({
      where: { id: proofId },
      data: {
        aiDecision: result.decision,
        aiReasoning: result.reasoning,
        aiConfidence: result.confidence,
      },
    });

    // Store training data in the background — invisible to the user, never blocks response
    void storeBrainData({
      proofId,
      milestoneText: milestoneTitle,
      proofText: extractedText,
      modelVotes: result.modelVotes,
      consensusLevel: result.consensusLevel,
      finalDecision: result.decision,
    });

    // Three-tier confidence logic
    let newStatus: string;
    let action: string;

    if (result.confidence < 60) {
      // Too uncertain — auto reject, startup can resubmit
      newStatus = "REJECTED";
      action = "REJECTED";
    } else if (result.confidence <= 85) {
      // Medium confidence — investor must review manually
      newStatus = "PENDING_REVIEW";
      action = "PENDING_REVIEW";
    } else if (result.decision === "YES") {
      // High confidence approved — auto release
      newStatus = "VERIFIED";
      action = "VERIFIED";
    } else {
      // High confidence rejected
      newStatus = "REJECTED";
      action = "REJECTED";
    }

    // Update milestone status if proof is linked to one
    if (proof.milestoneId) {
      await prisma.milestone.update({
        where: { id: proof.milestoneId },
        data: { status: newStatus as never },
      });
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: newStatus as never },
    });

    const amountUSD = (proof.milestone?.amountUSD ?? contract.amountUSD).toString();

    await writeAuditLog({
      contractId: contract.id,
      milestoneId: proof.milestoneId ?? undefined,
      event: "AI_DECISION",
      actor: "AI",
      metadata: { decision: result.decision, confidence: result.confidence, action, proofId, promptHash: VERIFICATION_PROMPT_HASH },
    });

    if (action === "PENDING_REVIEW" && contract.investor.notifyPendingReview) {
      void sendPendingReviewEmail({
        to: contract.investor.email,
        contractId: contract.id,
        milestoneTitle,
        aiReasoning: result.reasoning,
      });
    }

    if (action === "REJECTED" && contract.startup?.notifyRejected) {
      void sendRejectedEmail({
        to: contract.startup.email,
        contractId: contract.id,
        milestoneTitle,
        aiReasoning: result.reasoning,
      });
    }

    // Auto-release funds when AI approves with high confidence
    if (action === "VERIFIED") {
      try {
        const milestoneOrder = proof.milestone?.order ?? 0;

        // Retrieve the fulfillment key — stored server-side when escrow was created.
        // The smart contract verifies keccak256(fulfillment) == stored condition.
        const fulfillment = proof.milestone?.escrowFulfillment ?? contract.escrowFulfillment;
        if (!fulfillment) {
          throw new Error("Fulfillment key not found — cannot release escrow");
        }

        // Reveal fulfillment key to startup before attempting auto-release.
        // Even if releaseMilestone fails, the startup can self-execute on-chain.
        if (contract.startup?.email) {
          void sendFulfillmentKeyEmail({
            to: contract.startup.email,
            contractId: contract.id,
            milestoneTitle,
            fulfillment,
            contractIdHash: contractIdToBytes32(contract.id),
            milestoneOrder,
          });
        }

        const txHash = await releaseMilestone(contract.id, milestoneOrder, fulfillment);
        console.log("[verify] Auto-released on-chain:", txHash);

        if (proof.milestoneId) {
          const completedMilestone = await prisma.milestone.update({
            where: { id: proof.milestoneId },
            data: { status: "COMPLETED", evmTxHash: txHash },
            include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
          });
          const milestones = completedMilestone.contract.milestones;
          const remaining = milestones.find(
            (m) => m.id !== proof.milestoneId && !["COMPLETED", "EXPIRED"].includes(m.status)
          );
          const nextStatus = !remaining ? "COMPLETED" : remaining.status === "FUNDED" ? "FUNDED" : "AWAITING_ESCROW";
          await prisma.contract.update({ where: { id: contract.id }, data: { status: nextStatus as never } });
        } else {
          await prisma.contract.update({ where: { id: contract.id }, data: { status: "COMPLETED" } });
        }

        await writeAuditLog({
          contractId: contract.id,
          milestoneId: proof.milestoneId ?? undefined,
          event: "FUNDS_RELEASED",
          metadata: { txHash, amountUSD, auto: true },
        });

        // NFT minting is triggered by the frontend ContractPoller after COMPLETED status
        // is detected — decoupled to avoid Vercel serverless timeout issues.

        if (contract.startup?.notifyVerified) {
          void sendVerifiedEmail({ to: contract.startup.email, contractId: contract.id, milestoneTitle, amountUSD: amountUSD, txHash });
        }
        if (contract.investor.notifyMilestoneCompleted) {
          void sendMilestoneCompletedInvestorEmail({ to: contract.investor.email, contractId: contract.id, milestoneTitle, amountUSD });
        }

        return NextResponse.json({ decision: result.decision, reasoning: result.reasoning, confidence: result.confidence, action: "COMPLETED", txHash });
      } catch (releaseErr) {
        // Auto-release failed — leave status as VERIFIED so startup can retry manually
        console.error("[verify] Auto-release failed:", releaseErr);
      }
    }

    return NextResponse.json({
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
      action,
    });
  } catch (err) {
    console.error("Verification error:", err);
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
