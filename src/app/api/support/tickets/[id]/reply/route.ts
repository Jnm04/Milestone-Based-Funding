import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/support/tickets/[id]/reply — admin sends a chat reply visible to the user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    role: "admin",
    content: body.message.trim(),
    timestamp: new Date().toISOString(),
  };

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({ where: { id } });
      if (!ticket) return null;
      if (ticket.status === "CLOSED") return "closed" as const;

      const currentMessages = Array.isArray(ticket.messages)
        ? (ticket.messages as { role: string; content: string; timestamp?: string }[])
        : [];

      return tx.supportTicket.update({
        where: { id, updatedAt: ticket.updatedAt },
        data: {
          messages: [...currentMessages, newMessage],
          status: ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status,
        },
      });
    });
  } catch {
    return NextResponse.json({ error: "Conflict, please retry" }, { status: 409 });
  }

  if (updated === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (updated === "closed") return NextResponse.json({ error: "Ticket is closed" }, { status: 409 });

  await logAdminAction(req, "TICKET_REPLIED", "TICKET", id, {}, { messageLength: body.message.trim().length });

  return NextResponse.json(updated);
}
