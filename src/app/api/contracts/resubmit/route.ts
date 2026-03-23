import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "FUNDED" },
    });

    // Also reset any REJECTED milestones back to FUNDED
    await prisma.milestone.updateMany({
      where: { contractId, status: "REJECTED" },
      data: { status: "FUNDED" },
    });

    return NextResponse.json({ ok: true, status: "FUNDED" });
  } catch (err) {
    console.error("Resubmit error:", err);
    return NextResponse.json({ error: "Failed to reset contract" }, { status: 500 });
  }
}
