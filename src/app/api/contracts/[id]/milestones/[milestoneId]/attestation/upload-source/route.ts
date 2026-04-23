import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.investorId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.mode !== "ATTESTATION")
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  if (milestone.dataSourceType !== "FILE_UPLOAD")
    return NextResponse.json({ error: "Milestone data source type is not FILE_UPLOAD" }, { status: 409 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const allowed = new Set(["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "json", "png", "jpg", "jpeg"]);
  if (!allowed.has(ext)) return NextResponse.json({ error: "File type not allowed" }, { status: 415 });

  // Magic byte validation — extension alone can be spoofed
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const isPdf  = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
  const isPng  = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  const isZip  = header[0] === 0x50 && header[1] === 0x4B && header[2] === 0x03 && header[3] === 0x04;
  const isCfb  = header[0] === 0xD0 && header[1] === 0xCF && header[2] === 0x11 && header[3] === 0xE0;
  const magicOk: Record<string, boolean> = {
    pdf: isPdf, png: isPng, jpg: isJpeg, jpeg: isJpeg,
    docx: isZip, xlsx: isZip, doc: isCfb, xls: isCfb,
    // text formats have no magic bytes — accept as-is
    csv: true, txt: true, json: true,
  };
  if (!magicOk[ext]) return NextResponse.json({ error: "File content does not match extension" }, { status: 415 });

  const blob = await put(
    `attestation/${milestoneId}/source-${Date.now()}.${ext}`,
    file,
    { access: "public" }
  );

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { attestationFetchedBlob: blob.url },
  });

  return NextResponse.json({ success: true, blobUrl: blob.url });
}
