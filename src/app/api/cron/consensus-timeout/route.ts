import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { releaseMilestone } from "@/services/evm/escrow.service";
import { decryptFulfillment } from "@/lib/crypto";
import { writeAuditLog } from "@/services/evm/audit.service";

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find milestones where consensus deadline has passed but status is still AWAITING_VOTES
  const timedOut = await prisma.milestone.findMany({
    where: {
      consensusEnabled: true,
      consensusStatus: "AWAITING_VOTES",
      consensusDeadline: { lt: now },
    },
    include: {
      consensusVotes: { select: { vote: true } },
      contract: { include: { startup: true } },
    },
  });

  const results: { milestoneId: string; status: string; txHash?: string; error?: string }[] = [];

  for (const milestone of timedOut) {
    const yesVotes = milestone.consensusVotes.filter((v) => v.vote === "YES").length;
    const threshold = milestone.consensusThreshold ?? 1;

    if (yesVotes >= threshold) {
      // Consensus reached — release escrow before marking COMPLETED
      const rawFulfillment = milestone.escrowFulfillment ?? milestone.contract.escrowFulfillment;

      if (!rawFulfillment) {
        // No fulfillment key — mark COMPLETED in DB but log warning (funds already released or missing key)
        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { consensusStatus: "REACHED", status: "COMPLETED" },
        });
        results.push({ milestoneId: milestone.id, status: "REACHED", error: "no_fulfillment_key" });
        continue;
      }

      try {
        const fulfillment = decryptFulfillment(rawFulfillment);
        const txHash = await releaseMilestone(milestone.contractId, milestone.order, fulfillment);

        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { consensusStatus: "REACHED", status: "COMPLETED", evmTxHash: txHash, escrowFulfillment: null },
        });

        await writeAuditLog({
          contractId: milestone.contractId,
          milestoneId: milestone.id,
          event: "FUNDS_RELEASED",
          metadata: { txHash, trigger: "consensus_timeout", yesVotes, threshold },
        });

        results.push({ milestoneId: milestone.id, status: "REACHED", txHash });
      } catch (err) {
        console.error("[consensus-timeout] escrow release failed for milestone", milestone.id, err);
        // Mark as REACHED in DB even if on-chain release fails — prevents re-processing; ops team must resolve manually
        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { consensusStatus: "REACHED", status: "COMPLETED" },
        });
        results.push({ milestoneId: milestone.id, status: "REACHED", error: "release_failed" });
      }
    } else {
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { consensusStatus: "TIMED_OUT", status: "PENDING_REVIEW" },
      });
      results.push({ milestoneId: milestone.id, status: "TIMED_OUT" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
