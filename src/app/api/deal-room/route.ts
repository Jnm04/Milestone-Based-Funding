import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_ROOMS = 50;

/**
 * GET /api/deal-room — list deal rooms created by the current investor
 * POST /api/deal-room — create a new deal room
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkRateLimit(`deal-room-get:${session.user.id}`, 30, 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const take = 20;

  const rooms = await prisma.dealRoom.findMany({
    where: { investorId: session.user.id },
    include: {
      documents: { select: { id: true, name: true, sha256: true, uploadedAt: true }, take: 50 },
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rooms.length > take;
  const page = hasMore ? rooms.slice(0, take) : rooms;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({ rooms: page, nextCursor });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "INVESTOR") return NextResponse.json({ error: "Investors only" }, { status: 403 });

  if (!(await checkRateLimit(`deal-room-post:${session.user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const count = await prisma.dealRoom.count({ where: { investorId: session.user.id } });
  if (count >= MAX_ROOMS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROOMS} deal rooms allowed` }, { status: 422 });
  }

  const body = await request.json() as { title?: string };
  void body;

  const room = await prisma.dealRoom.create({
    data: {
      investorId: session.user.id,
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}
