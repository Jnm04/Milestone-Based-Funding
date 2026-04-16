import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getMilestoneEscrowState } from "@/services/evm/escrow.service";

/**
 * POST /api/escrow/sync
 * Called when the frontend detects "Already funded" on-chain but DB is still AWAITING_ESCROW.
 * Reads on-chain state and updates the DB to match.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();
    if (!contractId) {
      return NextResponse.json({ error: "contractId required" }, { status: 400 });
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

    const milestoneOrder = milestoneId
      ? (contract.milestones.find((m) => m.id === milestoneId)?.order ?? 0)
      : 0;

    // Verify on-chain that it's actually funded
    const state = await getMilestoneEscrowState(contractId, milestoneOrder);
    if (!state.funded) {
      return NextResponse.json({ error: "Not funded on-chain" }, { status: 409 });
    }

    // Update DB to reflect on-chain reality
    if (milestoneId) {
      // Wrap in transaction so concurrent syncs can't produce inconsistent status
      await prisma.$transaction(async (tx) => {
        await tx.milestone.update({
          where: { id: milestoneId },
          data: { status: "FUNDED" },
        });

        const allMilestones = await tx.milestone.findMany({
          where: { contractId },
          select: { status: true },
        });
        const allFunded = allMilestones.every((m) => m.status === "FUNDED");

        await tx.contract.update({
          where: { id: contractId },
          data: { status: allFunded ? "FUNDED" : "AWAITING_ESCROW" },
        });
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "FUNDED" },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow sync error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
