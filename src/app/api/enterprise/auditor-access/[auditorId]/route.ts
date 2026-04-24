import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/enterprise/auditor-access/[auditorId]
 * Revokes an auditor's access to the current user's workspace.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ auditorId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auditorId } = await params;

  await prisma.auditorClientAccess.updateMany({
    where: { auditorId, clientId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
