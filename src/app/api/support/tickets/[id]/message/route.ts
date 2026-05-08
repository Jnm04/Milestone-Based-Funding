import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// POST /api/support/tickets/[id]/message — authenticated user appends a message to their own ticket
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`support-msg:${session.user.id}:${ip}`, 30, 10 * 60 * 1000))) {
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

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return NextResponse.json({ error: "Ticket is closed" }, { status: 409 });
  }

  const currentMessages = Array.isArray(ticket.messages)
    ? (ticket.messages as { role: string; content: string; timestamp?: string }[])
    : [];

  const newMessage = {
    role: "user",
    content: body.message.trim(),
    timestamp: new Date().toISOString(),
  };

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: { messages: [...currentMessages, newMessage] },
  });

  return NextResponse.json(updated);
}
