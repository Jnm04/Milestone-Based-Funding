import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getXummPayloadResult } from "@/services/xrpl/xumm.service";
import { getXRPLClient } from "@/services/xrpl/client";

/**
 * POST /api/escrow/finish/confirm
 * Called after the frontend detects the user signed the EscrowFinish payload.
 * Submits the signed tx to XRPL and marks contract/milestone as COMPLETED.
 * Uses fire-and-forget submit (not submitAndWait) to avoid hanging.
 */
export async function POST(request: NextRequest) {
  try {
    const { contractId, payloadUuid, milestoneId } = await request.json();

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

    if (contract.status === "COMPLETED") {
      return NextResponse.json({ ok: true, action: "already_completed" });
    }

    const result = await getXummPayloadResult(payloadUuid);
    console.log("[finish/confirm] Xumm result:", JSON.stringify(result));

    if (!result?.signed) {
      return NextResponse.json({ error: "Transaction not signed yet" }, { status: 422 });
    }

    const client = await getXRPLClient();

    if (result.txBlob) {
      // Submit without waiting for validation (avoids hanging on expired LastLedgerSequence)
      const submitRes = await client.request({
        command: "submit",
        tx_blob: result.txBlob,
      });
      const engineResult = (submitRes.result as { engine_result?: string }).engine_result ?? "";
      console.log("[finish/confirm] XRPL submit result:", engineResult);

      // Accept success or "already in ledger" codes
      const ok = engineResult.startsWith("tes") || engineResult.startsWith("tec") ||
        engineResult === "tefALREADY" || engineResult === "tefPAST_SEQ";
      if (!ok) {
        return NextResponse.json({ error: `XRPL rejected: ${engineResult}` }, { status: 422 });
      }
    } else if (result.txHash) {
      // Xumm submitted it — verify on-chain
      try {
        const tx = await client.request({ command: "tx", transaction: result.txHash });
        const meta = tx.result.meta as { TransactionResult?: string } | undefined;
        const txResult = meta?.TransactionResult ?? "";
        if (txResult && txResult !== "tesSUCCESS") {
          return NextResponse.json({ error: `XRPL tx failed: ${txResult}` }, { status: 422 });
        }
      } catch {
        console.warn("[finish/confirm] Could not verify tx by hash, proceeding");
      }
    } else {
      return NextResponse.json({ error: "No tx blob or hash from Xumm" }, { status: 422 });
    }

    if (milestoneId) {
      // Mark this milestone COMPLETED
      const completedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "COMPLETED" },
        include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
      });

      const milestones = completedMilestone.contract.milestones;
      // With upfront funding, next milestone is FUNDED (not PENDING)
      const nextMilestone = milestones.find(
        (m) => m.id !== milestoneId && m.status === "FUNDED"
      );

      if (nextMilestone) {
        // Next milestone is already funded — startup can submit proof
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: "FUNDED" },
        });
      } else {
        // All milestones done
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: "COMPLETED" },
        });
      }
    } else {
      // Old behavior — no milestones
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "COMPLETED" },
      });
    }

    return NextResponse.json({ ok: true, action: "completed" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow finish confirm error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
