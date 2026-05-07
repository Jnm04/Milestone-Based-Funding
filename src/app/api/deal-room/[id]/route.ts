import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/deal-room/[id]
 * Accessible by the investor who created it, OR any authenticated user with the invite link
 * (we validate by inviteToken query param for startups who haven't accepted yet).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const room = await prisma.dealRoom.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { uploadedAt: "desc" } },
      investor: { select: { id: true, email: true, name: true, companyName: true } },
    },
  });

  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);

  const isInvestor = session?.user?.id === room.investorId;
  const isStartup = session?.user?.id === room.startupId;
  const isStartupWithToken =
    token !== null &&
    token !== undefined &&
    room.inviteToken !== null &&
    token.length === room.inviteToken.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(room.inviteToken));

  if (!isInvestor && !isStartupWithToken && !isStartup) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // If startup accesses via token for the first time, associate them.
  // WHERE guard on startupId: null prevents two simultaneous requests from both claiming the room.
  if (isStartupWithToken && session?.user?.id && !room.startupId) {
    await prisma.dealRoom.updateMany({
      where: { id, startupId: null },
      data: { startupId: session.user.id },
    });
  }

  return NextResponse.json({ room, isInvestor });
}
