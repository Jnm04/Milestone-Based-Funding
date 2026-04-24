import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

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

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }
  if (!Array.isArray(body.milestones) || body.milestones.length === 0) {
    return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
  }

  const template = await prisma.contractTemplate.create({
    data: {
      creatorId: session.user.id,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      industry: body.industry ?? null,
      milestones: body.milestones as object[],
      isPublic: body.isPublic ?? false,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
