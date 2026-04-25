import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import {
  verifyMilestone,
  verifyMilestoneImage,
  extractPdfText,
  extractOfficeText,
  categorizeFile,
  AIVerificationResultWithVotes,
} from "@/services/ai/verifier.service";
import { storeBrainData } from "@/services/brain/training.service";
import { ModelVote } from "@/services/brain/training.service";
import { generateEmbedding, storeProofEmbedding } from "@/services/brain/embedding.service";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";

  let milestoneText = "";
  let proofText = "";
  let saveToDataset = false;
  let fileBuffer: Buffer | null = null;
  let fileName: string | null = null;
  let fileMimeType: string | null = null;

  // Pre-computed result from a previous run — sent back by the frontend on save
  let precomputedVotes: ModelVote[] | null = null;
  let precomputedExtractedText: string | null = null;
  let precomputedConsensusLevel: number | null = null;
  let precomputedDecision: "YES" | "NO" | null = null;
  let notes: string | null = null;

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    milestoneText = (formData.get("milestoneText") as string) ?? "";
    proofText = (formData.get("proofText") as string) ?? "";
    saveToDataset = formData.get("saveToDataset") === "true";
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
      }
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      fileMimeType = file.type;
    }
    // Pre-computed fields (sent as form fields on save-only requests)
    const votesRaw = formData.get("precomputedVotes") as string | null;
    if (votesRaw) {
      try { precomputedVotes = JSON.parse(votesRaw); } catch { /* ignore */ }
    }
    precomputedExtractedText = (formData.get("precomputedExtractedText") as string | null) ?? null;
    const cl = formData.get("precomputedConsensusLevel");
    if (cl !== null) {
      const parsed = Number(cl);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) precomputedConsensusLevel = parsed;
    }
    const dec = formData.get("precomputedDecision") as string | null;
    if (dec === "YES" || dec === "NO") precomputedDecision = dec;
  } else {
    const body = await req.json();
    milestoneText = body.milestoneText ?? "";
    proofText = body.proofText ?? "";
    saveToDataset = body.saveToDataset ?? false;
    if (body.precomputedVotes) precomputedVotes = body.precomputedVotes;
    if (body.precomputedExtractedText != null) precomputedExtractedText = body.precomputedExtractedText;
    if (body.precomputedConsensusLevel != null) {
      const parsed = Number(body.precomputedConsensusLevel);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 5) precomputedConsensusLevel = parsed;
    }
    if (body.precomputedDecision === "YES" || body.precomputedDecision === "NO") precomputedDecision = body.precomputedDecision;
    if (body.notes) notes = String(body.notes);
  }

  if (!milestoneText) return NextResponse.json({ error: "milestoneText required" }, { status: 400 });

  // ── Save-only path: frontend sends back the already-computed result ───────
  // This avoids re-running verification (which could produce a different vote split).
  if (
    saveToDataset &&
    precomputedVotes &&
    precomputedExtractedText !== null &&
    precomputedConsensusLevel !== null &&
    precomputedDecision !== null
  ) {
    const sandboxProofId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Determine label + source directly (bypasses storeBrainData's silent try/catch)
    const yesCount = precomputedVotes.filter((v) => v.decision === "YES").length;
    const labelSource = yesCount === 5 || yesCount === 0 ? "AUTO_5_0"
      : yesCount === 4 || yesCount === 1 ? "AUTO_4_1"
      : "HUMAN_QUEUE";
    const label = precomputedDecision === "YES" ? "APPROVED" : "REJECTED";

    try {
      if (labelSource === "HUMAN_QUEUE") {
        await prisma.humanReviewQueue.upsert({
          where: { proofId: sandboxProofId },
          create: {
            proofId: sandboxProofId,
            milestoneText,
            proofText: precomputedExtractedText.slice(0, 10_000),
            fileUrl: null,
            modelVotes: precomputedVotes as never,
            consensusLevel: precomputedConsensusLevel,
          },
          update: { modelVotes: precomputedVotes as never, consensusLevel: precomputedConsensusLevel },
        });
      } else {
        await prisma.trainingEntry.create({
          data: {
            proofId: sandboxProofId,
            milestoneText,
            proofText: precomputedExtractedText.slice(0, 10_000),
            label,
            labelSource,
            modelVotes: precomputedVotes as never,
            consensusLevel: precomputedConsensusLevel,
            notes: notes ?? undefined,
          },
        });
      }
    } catch (err) {
      console.error("[sandbox/save] DB write failed:", err);
      return NextResponse.json({ error: "DB write failed", detail: String(err) }, { status: 500 });
    }

    // Fire-and-forget embedding (non-critical, no duplicate TrainingEntry)
    void (async () => {
      try {
        const combinedText = `Milestone: ${milestoneText}\n\nProof:\n${precomputedExtractedText.slice(0, 3_000)}`;
        const embedding = await generateEmbedding(combinedText);
        if (embedding) await storeProofEmbedding(sandboxProofId, embedding);
      } catch { /* embedding failure is non-fatal */ }
    })();

    return NextResponse.json({ saved: true });
  }

  // ── Verification path ─────────────────────────────────────────────────────
  if (!fileBuffer && !proofText) return NextResponse.json({ error: "file or proofText required" }, { status: 400 });

  let result: AIVerificationResultWithVotes;
  let extractedText = proofText;

  if (fileBuffer && fileName && fileMimeType) {
    const category = categorizeFile(fileMimeType, fileName);

    if (category === "image") {
      const mime = fileMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      result = await verifyMilestoneImage({ milestone: milestoneText, imageBuffer: fileBuffer, mimeType: mime });
      extractedText = `[Image file: ${fileName}]`;
    } else if (category === "pdf") {
      extractedText = await extractPdfText(fileBuffer);
      result = await verifyMilestone({ milestone: milestoneText, extractedText });
    } else if (category === "office") {
      extractedText = await extractOfficeText(fileBuffer, fileName);
      result = await verifyMilestone({ milestone: milestoneText, extractedText });
    } else {
      extractedText = fileBuffer.toString("utf-8");
      result = await verifyMilestone({ milestone: milestoneText, extractedText });
    }
  } else {
    result = await verifyMilestone({ milestone: milestoneText, extractedText: proofText });
  }

  // Auto-save if requested (text-only, no file — result is deterministic enough)
  if (saveToDataset && !fileBuffer) {
    const sandboxProofId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    void storeBrainData({
      proofId: sandboxProofId,
      milestoneText,
      proofText: extractedText,
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
    // Return full extracted text so the frontend can send it back on save
    extractedText,
    extractedTextPreview: extractedText.slice(0, 600),
  });
}
