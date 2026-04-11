import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";

/**
 * POST /api/contracts/resubmit
 * Allows a startup to resubmit proof after an AI rejection.
 * Resets contract status from REJECTED → FUNDED so a new PDF can be uploaded.
 *
 * Only allowed if:
 * - Status is REJECTED
 * - Deadline has not passed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { contractId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.startupId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status !== "REJECTED") {
      return NextResponse.json(
        { error: `Can only resubmit from REJECTED status, current: ${contract.status}` },
        { status: 409 }
      );
    }

    if (new Date() >= contract.cancelAfter) {
      return NextResponse.json(
        { error: "Deadline has passed. Use EscrowCancel to recover funds." },
        { status: 409 }
      );
    }

    // Count how many rejected proofs already exist for this contract.
    // After 3 rejections, escalate to manual review instead of allowing another AI attempt.
    const MAX_RESUBMITS = 3;
    const rejectedProofCount = await prisma.proof.count({
      where: { contractId, aiDecision: "NO" },
    });

    if (rejectedProofCount >= MAX_RESUBMITS) {
      // Escalate to manual review
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "PENDING_REVIEW" },
      });
      await prisma.milestone.updateMany({
        where: { contractId, status: "REJECTED" },
        data: { status: "PENDING_REVIEW" },
      });
      await writeAuditLog({
        contractId,
        event: "MANUAL_REVIEW_REJECTED",
        actor: session.user.id,
        metadata: { reason: `${rejectedProofCount} AI rejections — escalated to manual review` },
      });
      return NextResponse.json({ ok: true, status: "PENDING_REVIEW", escalated: true });
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "FUNDED" },
    });

    // Also reset any REJECTED milestones back to FUNDED
    await prisma.milestone.updateMany({
      where: { contractId, status: "REJECTED" },
      data: { status: "FUNDED" },
    });

    await writeAuditLog({
      contractId,
      event: "PROOF_RESUBMITTED",
      actor: session.user.id,
    });

    return NextResponse.json({ ok: true, status: "FUNDED" });
  } catch (err) {
    console.error("Resubmit error:", err);
    return NextResponse.json({ error: "Failed to reset contract" }, { status: 500 });
  }
}
