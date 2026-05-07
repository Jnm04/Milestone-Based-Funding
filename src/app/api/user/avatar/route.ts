import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
// Magic bytes: JPEG (FF D8), PNG (89 50 4E 47), GIF (47 49 46), WebP (RIFF...WEBP)
const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0xff, 0xd8] },                           // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47] },               // PNG
  { bytes: [0x47, 0x49, 0x46] },                     // GIF
  { bytes: [0x52, 0x49, 0x46, 0x46] },               // WebP (RIFF header)
];

function hasValidMagicBytes(buf: Uint8Array): boolean {
  return MAGIC_SIGNATURES.some(({ bytes, offset = 0 }) =>
    bytes.every((b, i) => buf[offset + i] === b)
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  // Magic-byte validation — verify actual file content matches claimed type
  const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasValidMagicBytes(headerBytes)) {
    return NextResponse.json({ error: "Invalid image file" }, { status: 400 });
  }

  const blob = await put(`avatars/${session.user.id}.${ext}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: blob.url },
  });

  return NextResponse.json({ avatarUrl: blob.url });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}
