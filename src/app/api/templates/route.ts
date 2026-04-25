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

/**
 * GET /api/templates — list the current user's own templates
 * POST /api/templates — create a new template
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.contractTemplate.findMany({
    where: { creatorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    name?: string;
    description?: string;
    industry?: string;
    milestones?: unknown[];
    isPublic?: boolean;
  };

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }
  if (body.name.length > MAX_NAME) {
    return NextResponse.json({ error: `Name must be ${MAX_NAME} characters or less` }, { status: 400 });
  }
  if (!Array.isArray(body.milestones) || body.milestones.length === 0) {
    return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
  }
  const milestoneError = validateMilestones(body.milestones);
  if (milestoneError) {
    return NextResponse.json({ error: milestoneError }, { status: 400 });
  }

  const template = await prisma.contractTemplate.create({
    data: {
      creatorId: session.user.id,
      name: body.name.trim().slice(0, MAX_NAME),
      description: typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION) : null,
      industry: typeof body.industry === "string" ? body.industry.slice(0, 100) : null,
      milestones: body.milestones as object[],
      isPublic: body.isPublic === true,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
