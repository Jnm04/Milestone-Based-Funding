import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getServerSession(authOptions);
  if (!template.isPublic && template.creatorId !== session?.user?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (template.creatorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    name?: string;
    description?: string;
    industry?: string;
    milestones?: unknown[];
    isPublic?: boolean;
  };

  const updated = await prisma.contractTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
      ...(body.industry !== undefined && { industry: body.industry }),
      ...(body.milestones !== undefined && { milestones: body.milestones as object[] }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
    },
  });

  return NextResponse.json({ template: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (template.creatorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.contractTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
