import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMilestone, mockVerifyMilestone } from "@/services/ai/verifier.service";
import { buildEscrowFinishTx, submitSignedTransaction } from "@/services/xrpl/escrow.service";

export async function POST(request: NextRequest) {
  try {
    const { proofId } = await request.json();

    if (!proofId) {
      return NextResponse.json({ error: "proofId is required" }, { status: 400 });
    }

    // Load proof + contract
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: { contract: { include: { investor: true } } },
    });

    if (!proof) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }

    const { contract } = proof;

    if (contract.status !== "PROOF_SUBMITTED") {
      return NextResponse.json(
        { error: `Contract is in status ${contract.status}, expected PROOF_SUBMITTED` },
        { status: 409 }
      );
    }

    if (!proof.extractedText) {
      return NextResponse.json(
        { error: "No extracted text available for this proof" },
        { status: 422 }
      );
    }

    // Run AI verification
    const useReal = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-...";
    const result = useReal
      ? await verifyMilestone({
          milestone: contract.milestone,
          extractedText: proof.extractedText,
        })
      : mockVerifyMilestone({
          milestone: contract.milestone,
          extractedText: proof.extractedText,
        });

    // Persist AI result on proof
    await prisma.proof.update({
      where: { id: proofId },
      data: {
        aiDecision: result.decision,
        aiReasoning: result.reasoning,
        aiConfidence: result.confidence,
      },
    });

    if (result.decision === "YES") {
      // Trigger EscrowFinish
      if (
        contract.escrowSequence &&
        contract.escrowCondition &&
        contract.escrowFulfillment
      ) {
        try {
          const finishTx = buildEscrowFinishTx({
            investorAddress: contract.investor.walletAddress,
            escrowSequence: contract.escrowSequence,
            fulfillment: contract.escrowFulfillment,
            condition: contract.escrowCondition,
          });

          // The platform signs EscrowFinish server-side
          // In production: use a funded platform wallet (fee payer)
          // For MVP: the finishTx is returned for the investor to sign via Xumm
          // TODO Phase 5: auto-submit with platform hot wallet

          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: "VERIFIED" },
          });

          return NextResponse.json({
            decision: result.decision,
            reasoning: result.reasoning,
            confidence: result.confidence,
            action: "ESCROW_FINISH_READY",
            escrowFinishTx: finishTx,
          });
        } catch (err) {
          console.error("EscrowFinish build failed:", err);
        }
      }

      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: "VERIFIED" },
      });
    } else {
      // AI said NO — startup can resubmit
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: "REJECTED" },
      });
    }

    return NextResponse.json({
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
      action: result.decision === "YES" ? "VERIFIED" : "REJECTED",
    });
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
