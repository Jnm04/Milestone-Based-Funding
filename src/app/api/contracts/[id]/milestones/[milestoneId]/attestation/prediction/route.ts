import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { computePrediction } from "@/services/attestation/predictor.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { id: true, investorId: true, auditorEmail: true, mode: true } } },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (milestone.contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation milestone" }, { status: 400 });
  }
  if (
    milestone.contract.investorId !== session.user.id &&
    milestone.contract.auditorEmail !== session.user.email
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const snapshotCount = await prisma.pulseCheckSnapshot.count({ where: { milestoneId } });

  if (snapshotCount < 3) {
    return NextResponse.json({ error: "insufficient_data", snapshotCount }, { status: 200 });
  }

  const prediction = await computePrediction(milestoneId);
  if (!prediction) {
    return NextResponse.json({ error: "insufficient_data", snapshotCount }, { status: 200 });
  }

  return NextResponse.json(prediction);
}
