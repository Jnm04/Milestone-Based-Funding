import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getXummPayloadResult } from "@/services/xrpl/xumm.service";
import { getXRPLClient } from "@/services/xrpl/client";

/**
 * POST /api/escrow/webhook
 * Called by Xumm after the investor signs the EscrowCreate transaction.
 * Xumm sends: { meta: { payload_uuidv4, signed }, custom_meta: { contractId } }
 *
 * We use this to fetch the on-chain escrow sequence and update the contract.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const uuid = body?.meta?.payload_uuidv4 as string | undefined;
    const signed = body?.meta?.signed as boolean | undefined;
    const contractId = body?.custom_meta?.blob?.contractId as string | undefined;

    if (!uuid || !contractId) {
      return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    if (!signed) {
      // User rejected — mark as DRAFT so investor can retry
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "AWAITING_ESCROW" }, // stays, investor can try again
      });
      return NextResponse.json({ ok: true, action: "rejected" });
    }

    // Get tx hash from Xumm
    const result = await getXummPayloadResult(uuid);
    if (!result?.txHash) {
      return NextResponse.json({ error: "No tx hash in Xumm result" }, { status: 422 });
    }

    // Fetch the transaction from XRPL to get the sequence number
    const client = await getXRPLClient();
    const txResponse = await client.request({
      command: "tx",
      transaction: result.txHash,
    });

    const tx = txResponse.result as { Sequence?: number; TransactionType?: string };

    if (tx.TransactionType !== "EscrowCreate") {
      return NextResponse.json({ error: "Not an EscrowCreate transaction" }, { status: 422 });
    }

    const escrowSequence = tx.Sequence;

    if (!escrowSequence) {
      return NextResponse.json({ error: "Could not determine escrow sequence" }, { status: 422 });
    }

    // Update contract: funded with escrow sequence
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: "FUNDED",
        escrowSequence,
      },
    });

    return NextResponse.json({ ok: true, action: "funded", escrowSequence });
  } catch (err) {
    console.error("Escrow webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
