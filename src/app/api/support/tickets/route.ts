import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";

// POST /api/support/tickets — create ticket (authenticated or anonymous with email)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  let body: { subject: string; message: string; email?: string; errorDigest?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subject, message, email, errorDigest } = body;
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message required" }, { status: 400 });
  }

  const resolvedEmail = session?.user?.email ?? email ?? null;

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session?.user?.id ?? null,
      email: resolvedEmail,
      subject: subject.slice(0, 200),
      messages: [{ role: "user", content: message }],
      errorDigest: errorDigest ?? null,
      priority: errorDigest ? "HIGH" : "LOW",
      status: "OPEN",
    },
  });

  return NextResponse.json({ ticketId: ticket.id }, { status: 201 });
}

// GET /api/support/tickets — admin: list all tickets
export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { user: { select: { email: true, name: true, role: true } } },
    }),
    prisma.supportTicket.count({ where: status ? { status } : undefined }),
  ]);

  return NextResponse.json({ tickets, total });
}
