import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; docId: string }> };

/**
 * GET /api/deal-room/[id]/documents/[docId]
 * Streams a private Vercel Blob document to authenticated deal room participants only.
 * Investor and the associated startup can download; everyone else gets 403.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, docId } = await params;

  const room = await prisma.dealRoom.findUnique({
    where: { id },
    select: { investorId: true, startupId: true },
  });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant =
    session.user.id === room.investorId || session.user.id === room.startupId;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.dealDocument.findUnique({
    where: { id: docId, dealRoomId: id },
    select: { url: true, name: true },
  });
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  const blobRes = await fetch(doc.url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!blobRes.ok) {
    return NextResponse.json({ error: "Failed to retrieve document" }, { status: 502 });
  }

  const safeName = doc.name.replace(/[^a-zA-Z0-9._\- ()]/g, "_");
  return new Response(blobRes.body, {
    headers: {
      "Content-Type": blobRes.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
