import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { cancelMilestone, getMilestoneEscrowState } from "@/services/evm/escrow.service";
import { writeAuditLog } from "@/services/evm/audit.service";

/**
 * POST /api/escrow/cancel
 * Platform wallet calls cancelMilestone() on the EVM smart contract,
 * returning RLUSD to the investor. No user signing required.
 * Only allowed after the milestone deadline has passed.
 *
 * Body: { contractId, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let milestoneOrder: number;
    let cancelAfterDate: Date;

    if (milestoneId) {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }

      cancelAfterDate = milestone.cancelAfter;
      milestoneOrder = milestone.order;

      if (new Date() < cancelAfterDate) {
        const daysLeft = Math.ceil(
          (cancelAfterDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return NextResponse.json(
          { error: `Milestone deadline not yet reached. ${daysLeft} day(s) remaining.` },
          { status: 409 }
        );
      }
    } else {
      cancelAfterDate = contract.cancelAfter;
      milestoneOrder = 0;

      if (new Date() < cancelAfterDate) {
        const daysLeft = Math.ceil(
          (cancelAfterDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return NextResponse.json(
          { error: `Deadline not yet reached. ${daysLeft} day(s) remaining.` },
          { status: 409 }
        );
      }

      if (!["FUNDED", "PROOF_SUBMITTED", "REJECTED"].includes(contract.status)) {
        return NextResponse.json(
          { error: `Cannot cancel contract in status: ${contract.status}` },
          { status: 409 }
        );
      }
    }

    // Check on-chain state before trying to cancel
    const onChain = await getMilestoneEscrowState(contractId, milestoneOrder);

    if (!onChain.funded || onChain.completed || onChain.cancelled) {
      // Escrow already settled — just update DB
      if (milestoneId) {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "EXPIRED" },
        });
      }
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ ok: true, action: "already_closed" });
    }

    // Platform wallet cancels on-chain — no user signing needed
    const txHash = await cancelMilestone(contractId, milestoneOrder);
    console.log("[escrow/cancel] Cancelled on-chain:", txHash);

    if (milestoneId) {
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "EXPIRED", evmTxHash: txHash },
      });
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "EXPIRED" },
    });

    await writeAuditLog({
      contractId,
      milestoneId: milestoneId ?? undefined,
      event: "ESCROW_CANCELLED",
      actor: session.user.id,
      metadata: { txHash },
    });

    return NextResponse.json({ ok: true, action: "cancelled", txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow cancel error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
