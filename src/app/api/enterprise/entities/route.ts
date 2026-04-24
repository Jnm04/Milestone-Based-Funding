import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { effectiveUserId } = await getEnterpriseContext(session.user.id);

  const org = await prisma.organisation.findUnique({ where: { ownerId: effectiveUserId } });
  if (!org) return NextResponse.json({ entities: [] });

  const entities = await prisma.entity.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ org, entities });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { effectiveUserId, role } = await getEnterpriseContext(session.user.id);
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { name?: string; parentEntityId?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (body.name.trim().length > 100) return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });

  let org = await prisma.organisation.findUnique({ where: { ownerId: effectiveUserId } });
  if (!org) {
    const user = await prisma.user.findUnique({ where: { id: effectiveUserId }, select: { companyName: true } });
    org = await prisma.organisation.create({
      data: { ownerId: effectiveUserId, name: user?.companyName ?? "My Organisation" },
    });
  }

  const entity = await prisma.entity.create({
    data: {
      orgId: org.id,
      name: body.name.trim(),
      parentEntityId: body.parentEntityId ?? null,
    },
  });

  return NextResponse.json({ entity }, { status: 201 });
}
