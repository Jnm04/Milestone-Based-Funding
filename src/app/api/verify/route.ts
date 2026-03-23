import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMilestone, verifyMilestoneImage, mockVerifyMilestone, categorizeFile } from "@/services/ai/verifier.service";
import fs from "fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { proofId } = await request.json();

    if (!proofId) {
      return NextResponse.json({ error: "proofId is required" }, { status: 400 });
    }

    // Load proof + contract + milestone
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        contract: { include: { investor: true, startup: true } },
        milestone: true,
      },
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

    // Use milestone title for verification if available, otherwise contract milestone
    const milestoneTitle = proof.milestone?.title ?? contract.milestone;

    // Run AI verification
    const extractedText = proof.extractedText ?? "";
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-...";
    const category = categorizeFile("", proof.fileName);

    let result;
    if (!hasApiKey) {
      result = mockVerifyMilestone({ milestone: milestoneTitle, extractedText });
    } else if (category === "image") {
      // Load file from disk and send to Claude Vision
      const filePath = path.join(process.cwd(), "public", proof.fileUrl);
      const imageBuffer = await fs.readFile(filePath);
      const ext = path.extname(proof.fileName).toLowerCase();
      const mimeMap: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
      };
      const mimeType = mimeMap[ext] ?? "image/jpeg";
      result = await verifyMilestoneImage({ milestone: milestoneTitle, imageBuffer, mimeType });
    } else {
      result = await verifyMilestone({
        milestone: milestoneTitle,
        extractedText: extractedText || "(No text could be extracted from this document.)",
      });
    }

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

    // Update milestone status if proof is linked to one
    if (proof.milestoneId) {
      await prisma.milestone.update({
        where: { id: proof.milestoneId },
        data: { status: newStatus as never },
      });
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
