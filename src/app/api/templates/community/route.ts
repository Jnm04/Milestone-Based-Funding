import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/templates/community
 * Public endpoint — no auth required.
 * Returns paginated public templates, optionally filtered by industry.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get("industry");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    isPublic: true,
    ...(industry ? { industry } : {}),
  };

  const [templates, total] = await Promise.all([
    prisma.contractTemplate.findMany({
      where,
      orderBy: { useCount: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        description: true,
        industry: true,
        milestones: true,
        useCount: true,
        createdAt: true,
      },
    }),
    prisma.contractTemplate.count({ where }),
  ]);

  return NextResponse.json({ templates, total, page, pages: Math.ceil(total / limit) });
}
