import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const MAX_MILESTONES = 20;
const MAX_NAME = 100;
const MAX_DESCRIPTION = 500;
const MAX_MILESTONE_TITLE = 200;

function validateMilestones(milestones: unknown[]): string | null {
  if (milestones.length > MAX_MILESTONES) return `Max ${MAX_MILESTONES} milestones allowed`;
  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i];
    if (!m || typeof m !== "object" || Array.isArray(m)) return `Milestone ${i + 1} is invalid`;
    const { title } = m as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim()) return `Milestone ${i + 1} must have a title`;
    if (title.length > MAX_MILESTONE_TITLE) return `Milestone ${i + 1} title too long`;
  }
  return null;
}

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

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
    }
    if (body.name.length > MAX_NAME) {
      return NextResponse.json({ error: `Name must be ${MAX_NAME} characters or less` }, { status: 400 });
    }
  }
  if (body.milestones !== undefined) {
    if (!Array.isArray(body.milestones) || body.milestones.length === 0) {
      return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
    }
    const milestoneError = validateMilestones(body.milestones);
    if (milestoneError) return NextResponse.json({ error: milestoneError }, { status: 400 });
  }

  const updated = await prisma.contractTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim().slice(0, MAX_NAME) }),
      ...(body.description !== undefined && {
        description: typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION) : null,
      }),
      ...(body.industry !== undefined && {
        industry: typeof body.industry === "string" ? body.industry.slice(0, 100) : null,
      }),
      ...(body.milestones !== undefined && { milestones: body.milestones as object[] }),
      ...(body.isPublic !== undefined && { isPublic: body.isPublic === true }),
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
