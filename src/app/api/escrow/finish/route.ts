import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEscrowFinishTx, submitSignedTransaction } from "@/services/xrpl/escrow.service";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";

/**
 * POST /api/escrow/finish
 * Triggers EscrowFinish after AI approval.
 *
 * MVP approach: returns Xumm sign request for the investor.
 * The investor must sign EscrowFinish (their account is the Owner).
 *
 * Note: In production, a funded platform hot-wallet would auto-submit this.
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

    if (contract.status !== "VERIFIED") {
      return NextResponse.json(
        { error: `Expected VERIFIED, got ${contract.status}` },
        { status: 409 }
      );
    }

    if (!contract.escrowSequence || !contract.escrowCondition || !contract.escrowFulfillment) {
      return NextResponse.json(
        { error: "Missing escrow data — cannot finish" },
        { status: 422 }
      );
    }

    const finishTx = buildEscrowFinishTx({
      investorAddress: contract.investor.walletAddress,
      escrowSequence: contract.escrowSequence,
      fulfillment: contract.escrowFulfillment,
      condition: contract.escrowCondition,
    });

    const returnUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/contract/${contractId}`;
    const payload = await createXummSignRequest(
      finishTx as unknown as Record<string, unknown> & { TransactionType: string },
      { returnUrl, expiresIn: 600 }
    );

    return NextResponse.json({
      xummUrl: payload.next.always,
      qrPng: payload.refs.qr_png,
      payloadUuid: payload.uuid,
    });
  } catch (err) {
    console.error("Escrow finish error:", err);
    return NextResponse.json({ error: "Failed to create EscrowFinish request" }, { status: 500 });
  }
}
