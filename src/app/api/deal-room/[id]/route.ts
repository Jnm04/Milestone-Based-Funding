import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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
  const isStartupWithToken = token && token === room.inviteToken;
  const isStartup = session?.user?.id === room.startupId;

  if (!isInvestor && !isStartupWithToken && !isStartup) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // If startup accesses via token for the first time, associate them
  if (isStartupWithToken && session?.user?.id && !room.startupId) {
    await prisma.dealRoom.update({
      where: { id },
      data: { startupId: session.user.id },
    });
  }

  return NextResponse.json({ room, isInvestor });
}
