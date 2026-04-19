import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/contracts/[id]/milestones/[milestoneId]/reputation
 *
 * Allows the startup to toggle reputationPublic on a COMPLETED milestone.
 * Body: { public: boolean }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { startupId: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Only the startup on this contract can manage reputation visibility" }, { status: 403 });
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, status: true, contractId: true, reputationSummary: true },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }
  if (milestone.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed milestones can have a public reputation card" }, { status: 400 });
  }
  if (!milestone.reputationSummary) {
    return NextResponse.json({ error: "Reputation summary not yet generated for this milestone" }, { status: 400 });
  }

  const body = await req.json() as { public?: unknown };
  if (typeof body.public !== "boolean") {
    return NextResponse.json({ error: "Body must include { public: boolean }" }, { status: 400 });
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { reputationPublic: body.public },
  });

  return NextResponse.json({ ok: true, reputationPublic: body.public });
}
