import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCryptoCondition } from "@/services/crypto/condition.service";
import { buildEscrowCreateTx } from "@/services/xrpl/escrow.service";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";
import { getXRPLClient } from "@/services/xrpl/client";

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

    // Get current ledger from our own XRPL node and set LastLedgerSequence explicitly.
    // Without this, Xumm's backend may set a stale value from its own node,
    // causing "LastLedgerSequence exceeded" errors.
    const xrplClient = await getXRPLClient();
    const serverInfo = await xrplClient.request({ command: "server_info" });
    const currentLedger = serverInfo.result.info.validated_ledger?.seq ?? 0;
    const escrowTxWithSeq = { ...escrowTx, LastLedgerSequence: currentLedger + 200 };

    // Create Xumm sign request — investor scans QR / taps in Xumm app
    const callbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/contract/${contractId}`;
    const payload = await createXummSignRequest(
      escrowTxWithSeq as unknown as Record<string, unknown> & { TransactionType: string },
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
