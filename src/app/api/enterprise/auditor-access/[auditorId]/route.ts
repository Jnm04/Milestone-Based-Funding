import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/enterprise/auditor-access/[auditorId]
 * Revokes an auditor's access to the current user's workspace.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ auditorId: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auditorId } = await params;

  await prisma.auditorClientAccess.updateMany({
    where: { auditorId, clientId: auth.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
