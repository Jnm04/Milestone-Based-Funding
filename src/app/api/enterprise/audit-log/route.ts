import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

// GET /api/enterprise/audit-log?page=1&action=MEMBER_INVITED
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isEnterprise: true },
  });
  if (!user?.isEnterprise) return NextResponse.json({ error: "Enterprise account required" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const action = searchParams.get("action") ?? undefined;

  const where = {
    orgId: session.user.id,
    ...(action ? { action } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.orgAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        action: true,
        detail: true,
        meta: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.orgAuditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pageSize: PAGE_SIZE });
}
