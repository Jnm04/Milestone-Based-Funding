import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 30;

// GET /api/notifications
// Bell: no params → last 30 + unreadCount
// Page: ?page=1&filter=all|unread → paginated
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const filter = searchParams.get("filter"); // "unread" | null

  const where = {
    userId: session.user.id,
    ...(filter === "unread" ? { read: false } : {}),
  };

  const [notifications, unreadCount, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    prisma.notification.count({ where }),
  ]);

  return NextResponse.json({ notifications, unreadCount, total, page, pageSize: PAGE_SIZE });
}
