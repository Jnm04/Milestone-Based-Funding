import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      status: true,
      milestones: { select: { id: true, status: true }, orderBy: { order: "asc" } },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contract);
}
