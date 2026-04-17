import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelMilestone, getMilestoneEscrowState, releaseMilestone } from "@/services/evm/escrow.service";
import { decryptFulfillment } from "@/lib/crypto";
import { writeAuditLog } from "@/services/evm/audit.service";
import { sendVerifiedEmail, sendMilestoneCompletedInvestorEmail, sendFulfillmentKeyEmail } from "@/lib/email";
import { contractIdToBytes32 } from "@/services/evm/escrow.service";
import { isValidCronSecret } from "@/lib/cron-auth";

/**
 * GET /api/cron/cancel-expired
 * Vercel Cron Job — runs every hour.
 * 1. Cancels FUNDED/PROOF_SUBMITTED/REJECTED milestones past their deadline.
 * 2. Auto-approves PENDING_REVIEW milestones stalled for >14 days (no investor action).
 */
export async function GET(request: NextRequest) {
  // Protect against external calls — Vercel sets this header on cron invocations
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── 1. Cancel expired funded milestones ──────────────────────────────────
  const expiredMilestones = await prisma.milestone.findMany({
    where: {
      status: { in: ["FUNDED", "PROOF_SUBMITTED", "REJECTED"] },
      cancelAfter: { lt: now },
    },
    include: { contract: true },
  });

  const cancelResults = await Promise.allSettled(
    expiredMilestones.map(async (milestone) => {
      try {
        const onChain = await getMilestoneEscrowState(milestone.contractId, milestone.order);

        if (!onChain.funded || onChain.completed || onChain.cancelled) {
          // Already settled on-chain — just sync DB
          await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "EXPIRED" } });
          await prisma.contract.update({ where: { id: milestone.contractId }, data: { status: "EXPIRED" } });
          return { id: milestone.id, action: "synced" };
        }

        const txHash = await cancelMilestone(milestone.contractId, milestone.order);
        await prisma.milestone.update({ where: { id: milestone.id }, data: { status: "EXPIRED", evmTxHash: txHash } });
        await prisma.contract.update({ where: { id: milestone.contractId }, data: { status: "EXPIRED" } });
        return { id: milestone.id, action: "cancelled", txHash };
      } catch (err) {
        console.error(`[cron/cancel-expired] Failed for milestone ${milestone.id}:`, err);
        throw err;
      }
    })
  );

  // ── 2. Auto-approve stalled PENDING_REVIEW milestones (>14 days) ─────────
  const stalledMilestones = await prisma.milestone.findMany({
    where: {
      status: "PENDING_REVIEW",
      updatedAt: { lt: fourteenDaysAgo },
    },
    include: {
      contract: { include: { investor: true, startup: true } },
    },
  });

  const approveResults = await Promise.allSettled(
    stalledMilestones.map(async (milestone) => {
      const { contract } = milestone;
      try {
        const rawFulfillment = milestone.escrowFulfillment ?? contract.escrowFulfillment;
        if (!rawFulfillment) {
          throw new Error(`No fulfillment key for milestone ${milestone.id}`);
        }
        const fulfillment = decryptFulfillment(rawFulfillment);

        const milestoneTitle = milestone.title;
        const amountUSD = milestone.amountUSD.toString();

        // Send fulfillment key to startup before attempting release
        if (contract.startup?.email) {
          sendFulfillmentKeyEmail({
            to: contract.startup.email,
            contractId: contract.id,
            milestoneTitle,
            fulfillment,
            contractIdHash: contractIdToBytes32(contract.id),
            milestoneOrder: milestone.order,
          }).catch((err) => console.error("[email] sendFulfillmentKeyEmail failed:", err));
        }

        const txHash = await releaseMilestone(contract.id, milestone.order, fulfillment);

        const completedMilestone = await prisma.milestone.update({
          where: { id: milestone.id },
          data: { status: "COMPLETED", evmTxHash: txHash },
          include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
        });

        const milestones = completedMilestone.contract.milestones;
        const remaining = milestones.find(
          (m) => m.id !== milestone.id && !["COMPLETED", "EXPIRED"].includes(m.status)
        );
        const nextStatus = !remaining ? "COMPLETED" : remaining.status === "FUNDED" ? "FUNDED" : "AWAITING_ESCROW";
        await prisma.contract.update({ where: { id: contract.id }, data: { status: nextStatus as never } });

        await writeAuditLog({
          contractId: contract.id,
          milestoneId: milestone.id,
          event: "MANUAL_REVIEW_APPROVED",
          actor: "SYSTEM",
          metadata: { auto: true, reason: "No investor action within 14 days" },
        });

        await writeAuditLog({
          contractId: contract.id,
          milestoneId: milestone.id,
          event: "FUNDS_RELEASED",
          metadata: { txHash, amountUSD, auto: true },
        });

        if (contract.startup?.notifyVerified) {
          sendVerifiedEmail({ to: contract.startup.email, contractId: contract.id, milestoneTitle, amountUSD, txHash })
            .catch((err) => console.error("[email] sendVerifiedEmail failed:", err));
        }
        if (contract.investor.notifyMilestoneCompleted) {
          sendMilestoneCompletedInvestorEmail({ to: contract.investor.email, contractId: contract.id, milestoneTitle, amountUSD })
            .catch((err) => console.error("[email] sendMilestoneCompletedInvestorEmail failed:", err));
        }

        return { id: milestone.id, action: "auto-approved", txHash };
      } catch (err) {
        console.error(`[cron/auto-approve] Failed for milestone ${milestone.id}:`, err);
        throw err;
      }
    })
  );

  const cancelSucceeded = cancelResults.filter((r) => r.status === "fulfilled").length;
  const cancelFailed = cancelResults.filter((r) => r.status === "rejected").length;
  const approveSucceeded = approveResults.filter((r) => r.status === "fulfilled").length;
  const approveFailed = approveResults.filter((r) => r.status === "rejected").length;

  // ── 3. Delete stale DRAFT / DECLINED contracts (>30 days, no escrow funds) ─
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const staleContracts = await prisma.contract.findMany({
    where: { status: { in: ["DRAFT", "DECLINED"] }, createdAt: { lt: thirtyDaysAgo } },
    select: { id: true },
  });
  const staleIds = staleContracts.map((c) => c.id);
  let deletedDrafts = 0;
  if (staleIds.length > 0) {
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { contractId: { in: staleIds } } }),
      prisma.proof.deleteMany({ where: { contractId: { in: staleIds } } }),
      prisma.milestone.deleteMany({ where: { contractId: { in: staleIds } } }),
      prisma.contract.deleteMany({ where: { id: { in: staleIds } } }),
    ]);
    deletedDrafts = staleIds.length;
  }

  // ── 3b. Decline AWAITING_ESCROW contracts stalled for >90 days ───────────
  // Startup accepted but investor never funded. No escrow locked — safe to decline.
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const { count: declinedAwaitingEscrow } = await prisma.contract.updateMany({
    where: { status: "AWAITING_ESCROW", createdAt: { lt: ninetyDaysAgo } },
    data: { status: "DECLINED" },
  });

  // ── 4. Re-trigger verification for stuck PROOF_SUBMITTED (proof has no aiDecision >5 min) ─
  const tenMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const stuckProofs = await prisma.proof.findMany({
    where: {
      aiDecision: null,
      createdAt: { lt: tenMinutesAgo },
      contract: { status: "PROOF_SUBMITTED" },
    },
    take: 10,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let retried = 0;
  if (stuckProofs.length > 0) {
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    await Promise.allSettled(
      stuckProofs.map(async (proof) => {
        try {
          await fetch(`${baseUrl}/api/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
            body: JSON.stringify({ proofId: proof.id }),
          });
          retried++;
        } catch (err) {
          console.error(`[cron/retry-verify] Failed for proof ${proof.id}:`, err);
        }
      })
    );
  }

  if (cancelFailed > 0 || approveFailed > 0) {
    console.error(
      `[cron/cancel-expired] FAILURES — cancelled: ${cancelSucceeded} ok, ${cancelFailed} failed | ` +
      `auto-approved: ${approveSucceeded} ok, ${approveFailed} failed`
    );
  } else {
    console.log(
      `[cron/cancel-expired] OK — cancelled: ${cancelSucceeded} | auto-approved: ${approveSucceeded} | ` +
      `drafts deleted: ${deletedDrafts} | awaiting-escrow declined: ${declinedAwaitingEscrow} | stuck proofs retried: ${retried}`
    );
  }

  return NextResponse.json({
    ok: true,
    cancelled: cancelSucceeded,
    cancelFailed,
    autoApproved: approveSucceeded,
    approveFailed,
    deletedDrafts,
    declinedAwaitingEscrow,
    retriedVerifications: retried,
  });
  } catch (err) {
    console.error("[cron/cancel-expired] Unexpected error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
