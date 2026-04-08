import { NextRequest, NextResponse } from "next/server";
import { verifyMilestone } from "@/services/ai/verifier.service";
import { storeBrainData } from "@/services/brain/training.service";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

/**
 * POST — run AI verification in sandbox mode (no escrow, no contract needed).
 * Used to generate training data manually.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { milestoneText, proofText, saveToDataset } = await req.json();
  if (!milestoneText || !proofText) {
    return NextResponse.json({ error: "milestoneText and proofText required" }, { status: 400 });
  }

  const result = await verifyMilestone({ milestone: milestoneText, extractedText: proofText });

  // Optionally store in brain dataset (when called from the sandbox labeling UI)
  if (saveToDataset) {
    const sandboxProofId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    void storeBrainData({
      proofId: sandboxProofId,
      milestoneText,
      proofText,
      modelVotes: result.modelVotes,
      consensusLevel: result.consensusLevel,
      finalDecision: result.decision,
    });
  }

  return NextResponse.json({
    decision: result.decision,
    reasoning: result.reasoning,
    confidence: result.confidence,
    modelVotes: result.modelVotes,
    consensusLevel: result.consensusLevel,
  });
}
