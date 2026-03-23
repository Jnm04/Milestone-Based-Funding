import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildEscrowFinishTx } from "@/services/xrpl/escrow.service";
import { getXRPLClient } from "@/services/xrpl/client";
import { createXummSignRequest } from "@/services/xrpl/xumm.service";

export async function POST(request: NextRequest) {
  try {
    const { contractId, milestoneId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { investor: true, startup: true, milestones: true },
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

    if (!contract.startup) {
      return NextResponse.json({ error: "No startup has joined this contract" }, { status: 422 });
    }

    let escrowSequence: number;
    let escrowCondition: string;
    let escrowFulfillment: string;

    if (milestoneId) {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.status !== "VERIFIED") {
        return NextResponse.json(
          { error: `Expected milestone in VERIFIED, got ${milestone.status}` },
          { status: 409 }
        );
      }
      if (!milestone.escrowSequence || !milestone.escrowCondition || !milestone.escrowFulfillment) {
        return NextResponse.json(
          { error: "Missing milestone escrow data — cannot finish" },
          { status: 422 }
        );
      }
      escrowSequence = milestone.escrowSequence;
      escrowCondition = milestone.escrowCondition;
      escrowFulfillment = milestone.escrowFulfillment;
    } else {
      if (!contract.escrowSequence || !contract.escrowCondition || !contract.escrowFulfillment) {
        return NextResponse.json(
          { error: "Missing escrow data — cannot finish" },
          { status: 422 }
        );
      }
      escrowSequence = contract.escrowSequence;
      escrowCondition = contract.escrowCondition;
      escrowFulfillment = contract.escrowFulfillment;
    }

    // Get current ledger to set a fresh LastLedgerSequence
    const xrplClient = await getXRPLClient();
    const serverInfo = await xrplClient.request({ command: "server_info" });
    const currentLedger = serverInfo.result.info.validated_ledger?.seq ?? 0;

    // EscrowFinish fee = 12 drops base + 10 drops per byte of fulfillment
    const fulfillmentBytes = Math.ceil(escrowFulfillment.length / 2);
    const fee = String(12 + fulfillmentBytes * 10);

    // Startup signs EscrowFinish (any account can submit, they pay the fee)
    const finishTx = {
      ...buildEscrowFinishTx({
        signerAddress: contract.startup.walletAddress as string,
        investorAddress: contract.investor.walletAddress as string,
        escrowSequence,
        fulfillment: escrowFulfillment,
        condition: escrowCondition,
      }),
      Fee: fee,
      LastLedgerSequence: currentLedger + 1000,
    };

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
