import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/support/tickets/mine — authenticated user fetches their own tickets
export async function GET(request: NextRequest) {
  const session = await getMobileSession(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subject: true,
      messages: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ tickets });
}
