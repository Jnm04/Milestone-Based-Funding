import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/templates/[id]/use
 * Increments useCount for a public template when someone loads it into the contract form.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const template = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (template.isPublic && template.creatorId !== session.user.id) {
    await prisma.contractTemplate.update({
      where: { id },
      data: { useCount: { increment: 1 } },
    });
  }

  return NextResponse.json({ ok: true });
}
