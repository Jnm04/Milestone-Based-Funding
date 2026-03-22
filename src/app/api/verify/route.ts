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
      include: { contract: { include: { investor: true, startup: true } } },
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

    // Run AI verification (fall back to mock if no text was extracted)
    const extractedText = proof.extractedText ?? "";
    const useReal = !!process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY !== "sk-ant-..." &&
      extractedText.length > 0;
    const result = useReal
      ? await verifyMilestone({
          milestone: contract.milestone,
          extractedText,
        })
      : mockVerifyMilestone({
          milestone: contract.milestone,
          extractedText,
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

    // Three-tier confidence logic
    let newStatus: string;
    let action: string;

    if (result.confidence < 60) {
      // Too uncertain — auto reject, startup can resubmit
      newStatus = "REJECTED";
      action = "REJECTED";
    } else if (result.confidence <= 85) {
      // Medium confidence — investor must review manually
      newStatus = "PENDING_REVIEW";
      action = "PENDING_REVIEW";
    } else if (result.decision === "YES") {
      // High confidence approved — auto release
      newStatus = "VERIFIED";
      action = "VERIFIED";
    } else {
      // High confidence rejected
      newStatus = "REJECTED";
      action = "REJECTED";
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: newStatus as never },
    });

    return NextResponse.json({
      decision: result.decision,
      reasoning: result.reasoning,
      confidence: result.confidence,
      action,
    });
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
