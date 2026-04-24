import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";

async function resolveOrgForUser(userId: string) {
  return prisma.organisation.findUnique({ where: { ownerId: userId } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { effectiveUserId, role } = await getEnterpriseContext(session.user.id);
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const org = await resolveOrgForUser(effectiveUserId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity || entity.orgId !== org.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { name?: string; parentEntityId?: string | null };
  if (body.name !== undefined && body.name.trim().length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  const updated = await prisma.entity.update({
    where: { id },
    data: {
      ...(body.name?.trim() ? { name: body.name.trim() } : {}),
      ...("parentEntityId" in body ? { parentEntityId: body.parentEntityId ?? null } : {}),
    },
  });

  return NextResponse.json({ entity: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { effectiveUserId, role } = await getEnterpriseContext(session.user.id);
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const org = await resolveOrgForUser(effectiveUserId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entity = await prisma.entity.findUnique({ where: { id } });
  if (!entity || entity.orgId !== org.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.entity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
