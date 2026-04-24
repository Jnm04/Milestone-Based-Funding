import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/deal-room/[id]/convert
 * Investor converts a Deal Room into a Contract.
 * Returns pre-filled contract draft data so the investor can open the contract form pre-loaded.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.dealRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.investorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (room.status === "CONVERTED" || room.status === "DECLINED") {
    return NextResponse.json({ error: "Deal room already closed" }, { status: 400 });
  }

  await prisma.dealRoom.update({ where: { id }, data: { status: "CONVERTED" } });

  return NextResponse.json({
    ok: true,
    message: "Deal room converted. Proceed to create a contract — the startup's documents are on record.",
    startupId: room.startupId,
  });
}
