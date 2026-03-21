import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEscrowCancelTx, getEscrowState } from "@/services/xrpl/escrow.service";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";

/**
 * POST /api/escrow/cancel
 * Triggers EscrowCancel for an expired contract.
 * Can be called by anyone after the CancelAfter deadline.
 * Returns a Xumm sign request for the investor to submit.
 */
export async function POST(request: NextRequest) {
  try {
    const { contractId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { investor: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Only allow cancel if deadline has passed
    if (new Date() < contract.cancelAfter) {
      const daysLeft = Math.ceil(
        (contract.cancelAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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

    if (!contract.escrowSequence) {
      return NextResponse.json({ error: "No escrow to cancel" }, { status: 422 });
    }

    // Verify escrow still exists on-chain before sending cancel
    const { exists } = await getEscrowState(
      contract.investor.walletAddress,
      contract.escrowSequence
    );

    if (!exists) {
      // Escrow already closed — just update DB
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ ok: true, action: "already_closed" });
    }

    const cancelTx = buildEscrowCancelTx({
      callerAddress: contract.investor.walletAddress,
      investorAddress: contract.investor.walletAddress,
      escrowSequence: contract.escrowSequence,
    });

    const returnUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/contract/${contractId}`;
    const payload = await createXummSignRequest(
      cancelTx as unknown as Record<string, unknown> & { TransactionType: string },
      { returnUrl, expiresIn: 600 }
    );

    // Mark as EXPIRED optimistically — webhook will confirm
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({
      xummUrl: payload.next.always,
      qrPng: payload.refs.qr_png,
      payloadUuid: payload.uuid,
    });
  } catch (err) {
    console.error("Escrow cancel error:", err);
    return NextResponse.json({ error: "Failed to create EscrowCancel request" }, { status: 500 });
  }
}
