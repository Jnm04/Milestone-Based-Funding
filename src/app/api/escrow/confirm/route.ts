import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getXummPayloadResult } from "@/services/xrpl/xumm.service";
import { submitSignedTransaction } from "@/services/xrpl/escrow.service";

/**
 * POST /api/escrow/confirm
 * Client-side alternative to the Xumm webhook — works on localhost.
 * Called after the frontend detects the user has signed the EscrowCreate payload.
 *
 * Since we use submit: false in Xumm, we get the signed tx blob from Xumm
 * and submit it to XRPL ourselves. submitAndWait gives us the sequence directly.
 *
 * Body: { contractId, payloadUuid }
 */
export async function POST(request: NextRequest) {
  try {
    const { contractId, payloadUuid } = await request.json();

    if (!contractId || !payloadUuid) {
      return NextResponse.json(
        { error: "contractId and payloadUuid are required" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Already funded — idempotent
    if (contract.status === "FUNDED") {
      return NextResponse.json({ ok: true, action: "already_funded", escrowSequence: contract.escrowSequence });
    }

    // Get the signed tx blob from Xumm (submit: false means Xumm only signs)
    const result = await getXummPayloadResult(payloadUuid);

    if (!result?.signed) {
      return NextResponse.json({ error: "Transaction not signed yet" }, { status: 422 });
    }

    if (!result.txBlob) {
      return NextResponse.json({ error: "No signed tx blob from Xumm" }, { status: 422 });
    }

    // Submit to XRPL ourselves and wait for validation
    const { sequence } = await submitSignedTransaction(result.txBlob);

    if (!sequence) {
      return NextResponse.json({ error: "Could not read escrow sequence from XRPL" }, { status: 422 });
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "FUNDED", escrowSequence: sequence },
    });

    return NextResponse.json({ ok: true, action: "funded", escrowSequence: sequence });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow confirm error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
