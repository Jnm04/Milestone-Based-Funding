import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/notifications/read-all — mark all notifications as read
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}
