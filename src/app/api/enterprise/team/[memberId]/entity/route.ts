import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { effectiveUserId, role } = await getEnterpriseContext(session.user.id);
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { memberId } = await params;
  const body = await req.json() as { entityId: string | null };

  const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!member || member.ownerId !== effectiveUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Validate entity belongs to this org if provided
  if (body.entityId) {
    const org = await prisma.organisation.findUnique({ where: { ownerId: effectiveUserId } });
    if (!org) return NextResponse.json({ error: "No organisation" }, { status: 400 });
    const entity = await prisma.entity.findUnique({ where: { id: body.entityId } });
    if (!entity || entity.orgId !== org.id) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }
  }

  const updated = await prisma.orgMember.update({
    where: { id: memberId },
    data: { entityId: body.entityId },
  });

  return NextResponse.json({ member: updated });
}
