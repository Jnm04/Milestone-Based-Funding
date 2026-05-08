import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/proof/confirm-draft
 * Startup confirms an agent-collected draft proof.
 * Clears draftStatus and triggers the AI verification pipeline.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // H-5: Rate limit — prevents spamming confirm-draft to trigger many AI verification jobs
  if (!(await checkRateLimit(`confirm-draft:${session.user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before confirming again." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const { proofId } = await request.json();
  if (!proofId) return NextResponse.json({ error: "proofId required" }, { status: 400 });

  // H-5: Atomic claim — use updateMany so only one concurrent confirm-draft wins.
  // Checks draftStatus === "DRAFT" and aiDecision === null in the same DB operation.
  const claimed = await prisma.proof.updateMany({
    where: { id: proofId, draftStatus: "DRAFT", aiDecision: null },
    data: { draftStatus: null },
  });

  if (claimed.count === 0) {
    // Either not a draft, already confirmed, or AI already decided
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      select: { id: true, contractId: true },
    });
    if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    return NextResponse.json({ error: "Not a draft proof or already confirmed" }, { status: 409 });
  }

  // Fetch contract/milestone ownership to verify authorization
  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: { contract: true },
  });

  if (!proof) return NextResponse.json({ error: "Proof not found" }, { status: 404 });

  if (proof.contract.startupId !== session.user.id) {
    // Undo the claim — wrong user
    await prisma.proof.update({
      where: { id: proofId },
      data: { draftStatus: "DRAFT" },
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
