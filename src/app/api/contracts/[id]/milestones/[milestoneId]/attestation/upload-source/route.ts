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
