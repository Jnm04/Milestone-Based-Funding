import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractPdfText, extractOfficeText, categorizeFile } from "@/services/ai/verifier.service";
import { sendProofSubmittedEmail } from "@/lib/email";
import { put } from "@vercel/blob";
import path from "path";
import crypto from "crypto";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";

async function triggerVerification(proofId: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    await fetch(`${baseUrl}/api/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ proofId }),
    });
  } catch (err) {
    console.error("[auto-verify] failed:", err);
  }
}

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
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 20 uploads per user per hour — prevents Vercel Blob cost abuse
    if (!checkRateLimit(`proof-upload:${session.user.id}`, 20, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait before submitting again." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

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
    // Only use extension fallback for plain-text formats where browsers commonly
    // send application/octet-stream. Binary office formats (docx/pptx/xlsx) must
    // carry the correct MIME from the browser — renaming a binary file to .docx
    // would still be rejected here if the browser doesn't send the right type.
    const extMimeMap: Record<string, string> = {
      ".csv": "text/csv",
      ".txt": "text/plain",
      ".md": "text/plain",
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
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const category = categorizeFile(effectiveMime, fileName);
    // Sanitize filename for use in Blob storage paths (keep original for display)
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

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
        include: { contract: { include: { investor: true, startup: true } } },
      });

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.contract.startupId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(milestone.status)) {
        return NextResponse.json(
          { error: `Cannot upload proof for milestone in status: ${milestone.status}` },
          { status: 409 }
        );
      }

      // Reject exact duplicate files for this milestone
      const duplicate = await prisma.proof.findFirst({
        where: { milestoneId, fileHash },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "This file has already been submitted as proof for this milestone." },
          { status: 409 }
        );
      }

      const filename = `proofs/${milestone.contractId}/${Date.now()}-${safeFileName}`;
      const blob = await put(filename, buffer, { access: "private", contentType: effectiveMime });
      const fileUrl = blob.url;

      const proof = await prisma.proof.create({
        data: { contractId: milestone.contractId, milestoneId, fileUrl, fileName, fileHash, extractedText },
      });

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "PROOF_SUBMITTED" },
      });

      await prisma.contract.update({
        where: { id: milestone.contractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      // Email investor: startup submitted proof
      if (milestone.contract.investor.notifyProofSubmitted) {
        sendProofSubmittedEmail({
          to: milestone.contract.investor.email,
          contractId: milestone.contractId,
          milestoneTitle: milestone.title,
          startupName: milestone.contract.startup?.companyName ?? milestone.contract.startup?.name,
          investorId: milestone.contract.investorId,
        }).catch((err) => console.error("[email] sendProofSubmittedEmail failed:", err));
      }

      await writeAuditLog({
        contractId: milestone.contractId,
        milestoneId,
        event: "PROOF_SUBMITTED",
        actor: session.user.id,
        metadata: { proofId: proof.id, fileName, fileHash },
      });

      fireWebhook({
        investorId: milestone.contract.investorId,
        startupId: milestone.contract.startupId ?? undefined,
        event: "proof.submitted",
        contractId: milestone.contractId,
        milestoneId,
        data: { proofId: proof.id, fileName, milestoneTitle: milestone.title },
      }).catch((err) => console.error("[webhook] proof.submitted failed:", err));

      // Auto-trigger AI verification after response is sent
      after(() => triggerVerification(proof.id));

      return NextResponse.json({
        proofId: proof.id,
        fileUrl,
        fileName: proof.fileName,
        textExtracted: extractedText !== null,
      });
    } else {
      // Old flow (backward compat) — contractId must be set
      const resolvedContractId = contractId!;
      const contract = await prisma.contract.findUnique({
        where: { id: resolvedContractId },
        include: { investor: true, startup: true },
      });
      if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      if (contract.startupId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["FUNDED", "PROOF_SUBMITTED", "PENDING_REVIEW"].includes(contract.status)) {
        return NextResponse.json({ error: `Cannot upload proof in status: ${contract.status}` }, { status: 409 });
      }

      // Reject exact duplicate files for this contract
      const duplicate = await prisma.proof.findFirst({
        where: { contractId: resolvedContractId, fileHash },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "This file has already been submitted as proof for this contract." },
          { status: 409 }
        );
      }

      const filename = `proofs/${resolvedContractId}/${Date.now()}-${safeFileName}`;
      const blob = await put(filename, buffer, { access: "private", contentType: effectiveMime });
      const fileUrl = blob.url;

      const proof = await prisma.proof.create({
        data: { contractId: resolvedContractId, fileUrl, fileName, fileHash, extractedText },
      });

      await prisma.contract.update({
        where: { id: resolvedContractId },
        data: { status: "PROOF_SUBMITTED" },
      });

      // Email investor: startup submitted proof
      if (contract.investor.notifyProofSubmitted) {
        sendProofSubmittedEmail({
          to: contract.investor.email,
          contractId: resolvedContractId,
          milestoneTitle: contract.milestone,
          startupName: contract.startup?.companyName ?? contract.startup?.name,
          investorId: contract.investorId,
        }).catch((err) => console.error("[email] sendProofSubmittedEmail failed:", err));
      }

      await writeAuditLog({
        contractId: resolvedContractId,
        event: "PROOF_SUBMITTED",
        actor: session.user.id,
        metadata: { proofId: proof.id, fileName, fileHash },
      });

      fireWebhook({
        investorId: contract.investorId,
        startupId: contract.startupId ?? undefined,
        event: "proof.submitted",
        contractId: resolvedContractId,
        data: { proofId: proof.id, fileName, milestoneTitle: contract.milestone },
      }).catch((err) => console.error("[webhook] proof.submitted failed:", err));

      // Auto-trigger AI verification after response is sent
      after(() => triggerVerification(proof.id));

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
