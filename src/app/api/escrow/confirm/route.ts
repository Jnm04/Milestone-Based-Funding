import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFundTx } from "@/services/evm/escrow.service";

/**
 * POST /api/escrow/confirm
 * Called after the frontend submits a fundMilestone transaction via MetaMask.
 * Verifies the transaction on-chain and marks the milestone/contract as FUNDED.
 *
 * Body: { contractId, txHash, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const { contractId, txHash, milestoneId } = await request.json();

    if (!contractId || !txHash) {
      return NextResponse.json(
        { error: "contractId and txHash are required" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Idempotent — already funded
    if (contract.status === "FUNDED") {
      return NextResponse.json({ ok: true, action: "already_funded" });
    }

    // Verify the transaction was mined successfully on-chain
    const { ok } = await verifyFundTx(txHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Transaction not found or failed on-chain. Please wait and retry." },
        { status: 422 }
      );
    }

    if (milestoneId) {
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "FUNDED", evmTxHash: txHash },
      });

      // Check if all milestones are now funded
      const allMilestones = await prisma.milestone.findMany({
        where: { contractId },
        select: { status: true },
      });
      const allFunded = allMilestones.every((m) => m.status === "FUNDED");

      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: allFunded ? "FUNDED" : "AWAITING_ESCROW",
          evmTxHash: allFunded ? txHash : undefined,
        },
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "FUNDED", evmTxHash: txHash },
      });
    }

    return NextResponse.json({ ok: true, action: "funded" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow confirm error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
