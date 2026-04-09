import { NextRequest, NextResponse } from "next/server";
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

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    milestoneText = (formData.get("milestoneText") as string) ?? "";
    proofText = (formData.get("proofText") as string) ?? "";
    saveToDataset = formData.get("saveToDataset") === "true";
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
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
    if (cl !== null) precomputedConsensusLevel = Number(cl);
    const dec = formData.get("precomputedDecision") as string | null;
    if (dec === "YES" || dec === "NO") precomputedDecision = dec;
  } else {
    const body = await req.json();
    milestoneText = body.milestoneText ?? "";
    proofText = body.proofText ?? "";
    saveToDataset = body.saveToDataset ?? false;
    if (body.precomputedVotes) precomputedVotes = body.precomputedVotes;
    if (body.precomputedExtractedText != null) precomputedExtractedText = body.precomputedExtractedText;
    if (body.precomputedConsensusLevel != null) precomputedConsensusLevel = Number(body.precomputedConsensusLevel);
    if (body.precomputedDecision === "YES" || body.precomputedDecision === "NO") precomputedDecision = body.precomputedDecision;
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
    await storeBrainData({
      proofId: sandboxProofId,
      milestoneText,
      proofText: precomputedExtractedText,
      modelVotes: precomputedVotes,
      consensusLevel: precomputedConsensusLevel,
      finalDecision: precomputedDecision,
    });
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
