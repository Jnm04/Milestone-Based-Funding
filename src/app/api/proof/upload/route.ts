import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractPdfText, extractOfficeText, categorizeFile } from "@/services/ai/verifier.service";
import path from "path";
import fs from "fs/promises";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/msword", // doc
  "application/vnd.ms-excel", // xls
  "application/vnd.ms-powerpoint", // ppt
  // Images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // Text
  "text/csv",
  "text/plain",
]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const milestoneId = formData.get("milestoneId") as string | null;
    const contractId = formData.get("contractId") as string | null;

    if (!file || (!milestoneId && !contractId)) {
      return NextResponse.json({ error: "file and contractId (or milestoneId) are required" }, { status: 400 });
    }

    // Some browsers send generic MIME for CSV/TXT — also check extension
    const mimeType = file.type || "";
    const fileName = file.name;
    const ext = path.extname(fileName).toLowerCase();
    const extMimeMap: Record<string, string> = {
      ".csv": "text/csv", ".txt": "text/plain", ".md": "text/plain",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    const effectiveMime = ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : (extMimeMap[ext] ?? mimeType);

    if (!ALLOWED_MIME_TYPES.has(effectiveMime)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: PDF, DOCX, PPTX, XLSX, images (JPG/PNG/WEBP/GIF), CSV, TXT." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const category = categorizeFile(effectiveMime, fileName);

    let extractedText: string | null = null;
    try {
      if (category === "pdf") {
        extractedText = await extractPdfText(buffer);
      } else if (category === "office") {
        extractedText = await extractOfficeText(buffer, fileName);
      } else if (category === "text") {
        extractedText = buffer.toString("utf-8").slice(0, 50000);
      }
      // images: no text extraction — Claude Vision handles these directly
    } catch (err) {
      console.error("Text extraction failed:", err);
    }

    if (milestoneId) {
      // New flow: milestone-based upload
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { contract: true },
      });

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.status !== "FUNDED") {
        return NextResponse.json(
          { error: `Cannot upload proof for milestone in status: ${milestone.status}` },
          { status: 409 }
        );
      }

      const uploadDir = path.join(process.cwd(), "public", "uploads", milestone.contractId);
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${Date.now()}-${fileName}`;
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      const fileUrl = `/uploads/${milestone.contractId}/${filename}`;

      const proof = await prisma.proof.create({
        data: { contractId: milestone.contractId, milestoneId, fileUrl, fileName, extractedText },
      });

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "PROOF_SUBMITTED" },
      });

      await prisma.contract.update({
        where: { id: milestone.contractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      return NextResponse.json({
        proofId: proof.id,
        fileUrl,
        fileName: proof.fileName,
        textExtracted: extractedText !== null,
      });
    } else {
      // Old flow (backward compat) — contractId must be set
      const resolvedContractId = contractId!;
      const contract = await prisma.contract.findUnique({ where: { id: resolvedContractId } });
      if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      if (contract.status !== "FUNDED") {
        return NextResponse.json({ error: `Cannot upload proof in status: ${contract.status}` }, { status: 409 });
      }

      const uploadDir = path.join(process.cwd(), "public", "uploads", resolvedContractId);
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${Date.now()}-${fileName}`;
      await fs.writeFile(path.join(uploadDir, filename), buffer);
      const fileUrl = `/uploads/${resolvedContractId}/${filename}`;

      const proof = await prisma.proof.create({
        data: { contractId: resolvedContractId, fileUrl, fileName, extractedText },
      });

      await prisma.contract.update({
        where: { id: resolvedContractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      return NextResponse.json({
        proofId: proof.id,
        fileUrl,
        fileName: proof.fileName,
        textExtracted: extractedText !== null,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Upload error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
