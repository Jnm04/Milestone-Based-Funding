import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import crypto from "crypto";

const MAX_FILES = 5;
const MAX_SIZE = 20 * 1024 * 1024;

/**
 * POST /api/deal-room/[id]/documents
 * Startup uploads a due-diligence document into a Deal Room.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.dealRoom.findUnique({ where: { id }, include: { documents: true } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.status !== "OPEN" && room.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Deal room is closed" }, { status: 400 });
  }

  const isStartup = session.user.id === room.startupId;
  const isInvestor = session.user.id === room.investorId;
  if (!isStartup && !isInvestor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (room.documents.length >= MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files per deal room` }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File exceeds 20 MB limit" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const blob = await put(`deal-room/${id}/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const doc = await prisma.dealDocument.create({
    data: {
      dealRoomId: id,
      name: file.name,
      url: blob.url,
      sha256,
    },
  });

  // Auto-set status to SUBMITTED once at least one document is uploaded
  if (room.status === "OPEN") {
    await prisma.dealRoom.update({ where: { id }, data: { status: "SUBMITTED" } });
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
