import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";

/**
 * POST /api/contracts/resubmit
 * Allows a startup to resubmit proof after an AI rejection.
 * Resets the specific milestone (and contract) from REJECTED → FUNDED.
 *
 * Only allowed if:
 * - The milestone/contract status is REJECTED
 * - The milestone's own deadline has not passed
 *
 * After MAX_RESUBMITS rejections for the same milestone, escalates to PENDING_REVIEW.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const MAX_RESUBMITS = 3;

    // ── Milestone-scoped resubmit (multi-milestone contracts) ─────────────────
    if (milestoneId) {
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { contract: true },
      });

      if (!milestone || milestone.contractId !== contractId) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.contract.startupId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (milestone.status !== "REJECTED") {
        return NextResponse.json(
          { error: `Can only resubmit from REJECTED status, current: ${milestone.status}` },
          { status: 409 }
        );
      }
      if (new Date() >= milestone.cancelAfter) {
        return NextResponse.json(
          { error: "Milestone deadline has passed. Cancel the escrow to recover funds." },
          { status: 409 }
        );
      }

      const rejectedProofCount = await prisma.proof.count({
        where: { milestoneId, aiDecision: "NO" },
      });

      if (rejectedProofCount >= MAX_RESUBMITS) {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { status: "PENDING_REVIEW" },
        });
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: "PENDING_REVIEW" },
        });
        await writeAuditLog({
          contractId,
          milestoneId,
          event: "MANUAL_REVIEW_REJECTED",
          actor: session.user.id,
          metadata: { reason: `${rejectedProofCount} AI rejections — escalated to manual review` },
        });
        return NextResponse.json({ ok: true, status: "PENDING_REVIEW", escalated: true });
      }

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "FUNDED" },
      });
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "FUNDED" },
      });
      await writeAuditLog({
        contractId,
        milestoneId,
        event: "PROOF_RESUBMITTED",
        actor: session.user.id,
      });

      return NextResponse.json({ ok: true, status: "FUNDED" });
    }

    // ── Contract-level resubmit (single-milestone / legacy) ──────────────────
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: { orderBy: { order: "asc" } } },
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

    // Use the active (rejected) milestone's own deadline if available,
    // otherwise fall back to the contract-level deadline.
    const rejectedMilestone = contract.milestones.find((m) => m.status === "REJECTED");
    const deadline = rejectedMilestone?.cancelAfter ?? contract.cancelAfter;

    if (new Date() >= deadline) {
      return NextResponse.json(
        { error: "Deadline has passed. Cancel the escrow to recover funds." },
        { status: 409 }
      );
    }

    const rejectedProofCount = await prisma.proof.count({
      where: {
        contractId,
        aiDecision: "NO",
        ...(rejectedMilestone ? { milestoneId: rejectedMilestone.id } : {}),
      },
    });

    if (rejectedProofCount >= MAX_RESUBMITS) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "PENDING_REVIEW" },
      });
      if (rejectedMilestone) {
        await prisma.milestone.update({
          where: { id: rejectedMilestone.id },
          data: { status: "PENDING_REVIEW" },
        });
      }
      await writeAuditLog({
        contractId,
        milestoneId: rejectedMilestone?.id,
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

    // Reset only the single rejected milestone, not all rejected milestones.
    if (rejectedMilestone) {
      await prisma.milestone.update({
        where: { id: rejectedMilestone.id },
        data: { status: "FUNDED" },
      });
    }

    await writeAuditLog({
      contractId,
      milestoneId: rejectedMilestone?.id,
      event: "PROOF_RESUBMITTED",
      actor: session.user.id,
    });

    return NextResponse.json({ ok: true, status: "FUNDED" });
  } catch (err) {
    console.error("Resubmit error:", err);
    return NextResponse.json({ error: "Failed to reset contract" }, { status: 500 });
  }
}
