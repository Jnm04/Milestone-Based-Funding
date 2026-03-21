import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCryptoCondition } from "@/services/crypto/condition.service";
import { buildEscrowCreateTx } from "@/services/xrpl/escrow.service";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";

export async function POST(request: NextRequest) {
  try {
    const { contractId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { investor: true, startup: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "AWAITING_ESCROW") {
      return NextResponse.json(
        { error: `Expected AWAITING_ESCROW, got ${contract.status}` },
        { status: 409 }
      );
    }

    if (!contract.startup) {
      return NextResponse.json(
        { error: "No startup has joined yet" },
        { status: 409 }
      );
    }

    // Generate crypto-condition — store fulfillment securely server-side
    const { condition, fulfillment } = generateCryptoCondition();

    // Save condition + fulfillment to DB before sending to Xumm
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        escrowCondition: condition,
        escrowFulfillment: fulfillment,
        amountRLUSD: contract.amountUSD.toString(),
      },
    });

    const escrowTx = buildEscrowCreateTx({
      investorAddress: contract.investor.walletAddress,
      startupAddress: contract.startup.walletAddress,
      amountRLUSD: contract.amountUSD.toString(),
      condition,
      cancelAfterDate: contract.cancelAfter,
    });

    // Create Xumm sign request — investor scans QR / taps in Xumm app
    const callbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/contract/${contractId}`;
    const payload = await createXummSignRequest(
      escrowTx as unknown as Record<string, unknown> & { TransactionType: string },
      {
        returnUrl: callbackUrl,
        expiresIn: 600,
        customMeta: { contractId }, // webhook uses this to identify the contract
      }
    );

    return NextResponse.json({
      xummUrl: payload.next.always,
      qrPng: payload.refs.qr_png,
      payloadUuid: payload.uuid, // frontend polls this to detect signing
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow create error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
