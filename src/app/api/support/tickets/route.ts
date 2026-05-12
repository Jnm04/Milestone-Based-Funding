import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

// POST /api/support/tickets — create ticket (authenticated or anonymous with email)
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  const ip = getClientIp(req);

  // Rate limit: 5 tickets per hour per user/IP
  const rlKey = session?.user?.id
    ? `support-ticket:${session.user.id}`
    : `support-ticket:${ip}`;
  if (!(await checkRateLimit(rlKey, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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
  if (subject.length > MAX_SUBJECT) {
    return NextResponse.json({ error: `subject too long (max ${MAX_SUBJECT})` }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: `message too long (max ${MAX_MESSAGE})` }, { status: 400 });
  }

  const resolvedEmail = session?.user?.email ?? email ?? null;
  if (!session?.user?.id && (!resolvedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedEmail))) {
    return NextResponse.json({ error: "valid email required for anonymous tickets" }, { status: 400 });
  }

  // errorDigest is server-trusted only when it matches a known Next.js digest pattern
  const safeDigest =
    typeof errorDigest === "string" && /^[a-zA-Z0-9]{6,64}$/.test(errorDigest)
      ? errorDigest.slice(0, 64)
      : null;

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session?.user?.id ?? null,
      email: resolvedEmail,
      subject: subject.trim().slice(0, MAX_SUBJECT),
      messages: [{ role: "user", content: message.trim(), timestamp: new Date().toISOString() }],
      errorDigest: safeDigest,
      priority: safeDigest ? "HIGH" : "LOW",
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
