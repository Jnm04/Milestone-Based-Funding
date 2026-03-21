import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { extractPdfText } from "@/services/ai/verifier.service";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const contractId = formData.get("contractId") as string | null;

    if (!file || !contractId) {
      return NextResponse.json(
        { error: "file and contractId are required" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are accepted" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit" },
        { status: 400 }
      );
    }

    // Verify contract exists and is in the right state
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "FUNDED") {
      return NextResponse.json(
        { error: `Cannot upload proof for contract in status: ${contract.status}` },
        { status: 409 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract PDF text before uploading
    let extractedText: string | null = null;
    try {
      extractedText = await extractPdfText(buffer);
    } catch (err) {
      console.error("PDF text extraction failed:", err);
      // Don't block upload — AI verification will fail gracefully
    }

    // Upload to Vercel Blob
    const blob = await put(`proofs/${contractId}/${Date.now()}-${file.name}`, buffer, {
      access: "public",
      contentType: "application/pdf",
    });

    // Save proof record
    const proof = await prisma.proof.create({
      data: {
        contractId,
        fileUrl: blob.url,
        fileName: file.name,
        extractedText,
      },
    });

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "PROOF_SUBMITTED" },
    });

    return NextResponse.json({
      proofId: proof.id,
      fileUrl: blob.url,
      fileName: proof.fileName,
      textExtracted: extractedText !== null,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
