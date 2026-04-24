import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/deal-room — list deal rooms created by the current investor
 * POST /api/deal-room — create a new deal room
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rooms = await prisma.dealRoom.findMany({
    where: { investorId: session.user.id },
    include: {
      documents: { select: { id: true, name: true, sha256: true, uploadedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ rooms });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "INVESTOR") return NextResponse.json({ error: "Investors only" }, { status: 403 });

  const body = await request.json() as { title?: string };

  const room = await prisma.dealRoom.create({
    data: {
      investorId: session.user.id,
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}
