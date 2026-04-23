import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  sector:     z.enum(["MANUFACTURING", "TECH", "FINANCE", "ENERGY", "HEALTHCARE", "RETAIL", "OTHER"]),
  contractId: z.string().min(1).max(50).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const assessment = await prisma.materialityAssessment.create({
    data: {
      userId: session.user.id,
      sector: parsed.data.sector,
      contractId: parsed.data.contractId ?? null,
      answers: [],
    },
  });

  return NextResponse.json({ id: assessment.id }, { status: 201 });
}

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assessments = await prisma.materialityAssessment.findMany({
    where: { userId: session.user.id },
    select: { id: true, sector: true, status: true, createdAt: true, summary: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assessments);
}
