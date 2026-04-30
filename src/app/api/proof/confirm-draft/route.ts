import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/proof/confirm-draft
 * Startup confirms an agent-collected draft proof.
 * Clears draftStatus and triggers the AI verification pipeline.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proofId } = await request.json();
  if (!proofId) return NextResponse.json({ error: "proofId required" }, { status: 400 });

  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: { contract: true },
  });

  if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  if (proof.draftStatus !== "DRAFT") return NextResponse.json({ error: "Not a draft proof" }, { status: 409 });

  const isStartup = proof.contract.startupId === session.user.id;
  const isInvestor = proof.contract.investorId === session.user.id;
  if (!isStartup && !isInvestor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Confirm draft
  await prisma.proof.update({
    where: { id: proofId },
    data: { draftStatus: null },
  });

  // Update contract/milestone status to PROOF_SUBMITTED
  if (proof.milestoneId) {
    await prisma.milestone.update({ where: { id: proof.milestoneId }, data: { status: "PROOF_SUBMITTED" as never } });
  }
  await prisma.contract.update({ where: { id: proof.contractId }, data: { status: "PROOF_SUBMITTED" as never } });

  // Trigger AI verification
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  void fetch(`${baseUrl}/api/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ proofId }),
  }).catch((err) => console.warn("[confirm-draft] Failed to trigger verify:", err));

  return NextResponse.json({ ok: true, proofId });
}
