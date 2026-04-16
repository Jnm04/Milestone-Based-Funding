import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";

/**
 * DELETE /api/proof/:proofId
 *
 * Allows a startup to delete their own proof before the AI has made a decision.
 * Resets the milestone back to FUNDED so they can re-upload.
 *
 * Conditions for deletion:
 * - Authenticated as the startup on this contract
 * - aiDecision must be null (AI hasn't decided yet)
 * - Milestone must be in PROOF_SUBMITTED status
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { proofId } = await params;

  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    select: {
      id: true,
      fileUrl: true,
      aiDecision: true,
      milestoneId: true,
      contractId: true,
      milestone: {
        select: {
          id: true,
          status: true,
          contract: {
            select: { startupId: true, investorId: true },
          },
        },
      },
    },
  });

  if (!proof) {
    return NextResponse.json({ error: "Proof not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const contract = proof.milestone?.contract;

  // Only the startup party may delete a proof
  if (contract?.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  // Cannot delete after AI has already decided
  if (proof.aiDecision !== null) {
    return NextResponse.json(
      { error: "Cannot delete proof after AI has already made a decision", code: "ALREADY_DECIDED" },
      { status: 409 }
    );
  }

  // Proof must still be in submitted state (not yet decided)
  if (proof.milestone?.status !== "PROOF_SUBMITTED") {
    return NextResponse.json(
      { error: "Proof can only be deleted while the milestone is awaiting AI decision", code: "WRONG_STATUS" },
      { status: 409 }
    );
  }

  // Delete the file from Vercel Blob storage (best-effort — don't fail if URL not a Blob URL)
  if (proof.fileUrl && proof.fileUrl.includes("vercel-storage.com")) {
    try {
      await del(proof.fileUrl);
    } catch (blobErr) {
      console.warn("[proof-delete] Blob delete failed (continuing):", blobErr);
    }
  }

  // Delete the proof record and reset milestone status in a transaction
  await prisma.$transaction([
    prisma.proof.delete({ where: { id: proofId } }),
    ...(proof.milestoneId
      ? [prisma.milestone.update({ where: { id: proof.milestoneId }, data: { status: "FUNDED" } })]
      : []),
  ]);

  return NextResponse.json({ ok: true });
}
