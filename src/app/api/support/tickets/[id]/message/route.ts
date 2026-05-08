import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/support/tickets/[id]/message — authenticated user appends a message to their own ticket
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`support-msg:${session.user.id}`, 30, 10 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  let body: { message: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (body.message.length > 5000) {
    return NextResponse.json({ error: "message too long" }, { status: 400 });
  }

  const newMessage = {
    role: "user",
    content: body.message.trim(),
    timestamp: new Date().toISOString(),
  };

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id } });
      if (!ticket) return null;
      if (ticket.userId !== session.user!.id) return "forbidden" as const;
      if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") return "closed" as const;

      const currentMessages = Array.isArray(ticket.messages)
        ? (ticket.messages as { role: string; content: string; timestamp?: string }[])
        : [];

      if (currentMessages.length >= 100) return "full" as const;

      return tx.supportTicket.update({
        where: { id, updatedAt: ticket.updatedAt },
        data: { messages: [...currentMessages, newMessage] },
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
    });
  } catch {
    return NextResponse.json({ error: "Conflict, please retry" }, { status: 409 });
  }

  if (updated === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (updated === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (updated === "closed") return NextResponse.json({ error: "Ticket is closed" }, { status: 409 });
  if (updated === "full") return NextResponse.json({ error: "Ticket has reached the maximum message limit" }, { status: 422 });

  return NextResponse.json(updated);
}
