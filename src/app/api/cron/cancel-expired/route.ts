import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelMilestone, getMilestoneEscrowState } from "@/services/evm/escrow.service";

/**
 * GET /api/cron/cancel-expired
 * Vercel Cron Job — runs every hour.
 * Finds all FUNDED milestones past their deadline and cancels them on-chain,
 * returning RLUSD to the investor.
 */
export async function GET(request: NextRequest) {
  // Protect against external calls — Vercel sets this header on cron invocations
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all expired funded milestones
  const expiredMilestones = await prisma.milestone.findMany({
    where: {
      status: { in: ["FUNDED", "PROOF_SUBMITTED", "REJECTED"] },
      cancelAfter: { lt: now },
    },
    include: { contract: true },
  });

  if (expiredMilestones.length === 0) {
    return NextResponse.json({ ok: true, cancelled: 0 });
  }

  const results = await Promise.allSettled(
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

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[cron/cancel-expired] Processed ${expiredMilestones.length} milestones — ${succeeded} ok, ${failed} failed`);

  return NextResponse.json({ ok: true, cancelled: succeeded, failed });
}
