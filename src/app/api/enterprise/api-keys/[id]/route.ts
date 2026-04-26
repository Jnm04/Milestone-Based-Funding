import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeOrgAuditLog } from "@/lib/org-audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (key.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.apiKey.update({ where: { id }, data: { active: false } });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "API_KEY_DELETED",
    detail: `API key "${key.name}" deleted`,
    meta: { keyName: key.name, keyPrefix: key.keyPrefix },
  });

  return NextResponse.json({ ok: true });
}
