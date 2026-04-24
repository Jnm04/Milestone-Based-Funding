import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auditor/clients
 * Returns all enterprise clients that have granted this auditor access.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const auditorPartner = await prisma.auditorPartner.findUnique({
    where: { userId: session.user.id },
  });
  if (!auditorPartner) return NextResponse.json({ error: "Auditor partner account required" }, { status: 403 });

  const clients = await prisma.auditorClientAccess.findMany({
    where: { auditorId: auditorPartner.id, revokedAt: null },
    include: {
      client: {
        select: {
          id: true,
          email: true,
          name: true,
          companyName: true,
          createdAt: true,
        },
      },
    },
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json({ clients });
}
