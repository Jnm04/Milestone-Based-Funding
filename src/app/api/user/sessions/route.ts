import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.loginEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, ip: true, userAgent: true, createdAt: true },
  });

  return NextResponse.json({ events });
}

// Sign out all sessions by incrementing sessionVersion
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkRateLimit(`revoke-sessions:${session.user.id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionVersion: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
