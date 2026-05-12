import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { del } from "@vercel/blob";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/services/evm/audit.service";

/**
 * DELETE /api/proof/:proofId
 *
 * Allows a startup to delete their own proof before the AI has made a decision.
 * Resets the milestone back to FUNDED so they can re-upload.
 *
 * Conditions for deletion:
 * - Authenticated as the startup on this contract (STARTUP role required)
 * - aiDecision must be null (AI hasn't decided yet)
 * - Milestone must be in PROOF_SUBMITTED status
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ proofId: string }> }
) {
  const session = await getMobileSession(_req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  // H-2: Role check — only STARTUPs can delete proofs
  if (session.user.role !== "STARTUP") {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  if (!(await checkRateLimit(`proof-delete:${session.user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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

  // H-1: Use atomic conditional delete to prevent TOCTOU race with the verify route.
  // deleteMany with aiDecision: null + milestone status PROOF_SUBMITTED ensures we
  // cannot delete a proof that was decided between the findUnique above and this write.
  const deleted = await prisma.proof.deleteMany({
    where: {
      id: proofId,
      aiDecision: null,
      milestone: { status: "PROOF_SUBMITTED" },
    },
  });

  if (deleted.count === 0) {
    // Either the AI decided in the meantime, or the milestone status changed
    return NextResponse.json(
      { error: "Cannot delete proof after AI has already made a decision", code: "ALREADY_DECIDED" },
      { status: 409 }
    );
  }

  // Delete the file from Vercel Blob storage (best-effort)
  if (proof.fileUrl && proof.fileUrl.includes("vercel-storage.com")) {
    try {
      await del(proof.fileUrl);
    } catch (blobErr) {
      console.warn("[proof-delete] Blob delete failed (continuing):", blobErr);
    }
  }

  // Reset milestone + contract status
  await prisma.$transaction([
    ...(proof.milestoneId
      ? [prisma.milestone.update({ where: { id: proof.milestoneId }, data: { status: "FUNDED" } })]
      : []),
    prisma.contract.update({ where: { id: proof.contractId }, data: { status: "FUNDED" } }),
  ]);

  // H-3: Audit trail — record deletion so evidence cannot be silently erased
  void writeAuditLog({
    contractId: proof.contractId,
    milestoneId: proof.milestoneId ?? undefined,
    event: "PROOF_DELETED",
    actor: session.user.id,
    metadata: { proofId, deletedAt: new Date().toISOString() },
  }).catch((err) => console.warn("[proof-delete] audit log failed:", err));

  return NextResponse.json({ ok: true });
}
