import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, auditorEmail: true, mode: true },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });
  }

  const isOwner = contract.investorId === session.user.id;
  const isAuditor = contract.auditorEmail === session.user.email;
  if (!isOwner && !isAuditor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify the milestone actually belongs to this contract before returning its entries
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const entries = await prisma.attestationEntry.findMany({
    where: { milestoneId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      period: true,
      fetchedAt: true,
      fetchedHash: true,
      aiVerdict: true,
      aiReasoning: true,
      xrplTxHash: true,
      certUrl: true,
      type: true,
      auditorEmail: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries });
}
