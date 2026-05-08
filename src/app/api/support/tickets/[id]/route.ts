import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit";

// GET /api/support/tickets/[id] — authenticated user fetches one of their own tickets
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      subject: true,
      messages: true,
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      updatedAt: true,
    },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Strip userId from response
  const { userId: _, ...safeTicket } = ticket;
  return NextResponse.json(safeTicket);
}

// PATCH /api/support/tickets/[id] — admin: update status / add note
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { status?: string; adminNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.adminNote !== undefined) updates.adminNote = (body.adminNote ?? "").slice(0, 5000);
  // Only set resolvedAt when first resolving; preserve the original value when closing
  if (body.status === "RESOLVED") updates.resolvedAt = new Date();
  // CLOSED: only set resolvedAt if not already set (ticket was closed directly without being resolved first)
  if (body.status === "CLOSED" && !existing.resolvedAt) updates.resolvedAt = new Date();

  const updated = await prisma.supportTicket.update({ where: { id }, data: updates });

  await logAdminAction(req, "TICKET_UPDATED", "TICKET", id, { status: existing.status }, { status: updated.status });

  return NextResponse.json(updated);
}
