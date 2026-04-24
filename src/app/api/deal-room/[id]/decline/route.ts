import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const room = await prisma.dealRoom.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (room.investorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.dealRoom.update({ where: { id }, data: { status: "DECLINED" } });
  return NextResponse.json({ ok: true });
}
