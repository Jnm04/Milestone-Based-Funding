import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/unread-count — returns number of unread notifications
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  });

  return NextResponse.json({ count });
}
