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
      investorId: true,
      startupId: true,
      status: true,
      milestones: { select: { id: true, status: true }, orderBy: { order: "asc" } },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.investorId !== session.user.id && contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { investorId: _i, startupId: _s, ...contractData } = contract;
  return NextResponse.json(contractData);
}
