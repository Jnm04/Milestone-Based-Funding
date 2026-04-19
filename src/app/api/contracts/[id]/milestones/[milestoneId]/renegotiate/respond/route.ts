/**
 * POST /api/contracts/[id]/milestones/[milestoneId]/renegotiate/respond
 *
 * Investor approves or rejects a startup's extension request.
 * APPROVE → reset milestone to FUNDED with new cancelAfter
 * REJECT  → cancel escrow on-chain, set milestone to EXPIRED
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { cancelMilestone } from "@/services/evm/escrow.service";
import { writeAuditLog } from "@/services/evm/audit.service";
import { sendExtensionApprovedEmail, sendExtensionRejectedEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  // ── Load milestone with contract ──────────────────────────────────────────
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: {
        include: { investor: true, startup: true, milestones: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  // ── Auth: only the investor ───────────────────────────────────────────────
  if (milestone.contract.investorId !== session.user.id) {
    return NextResponse.json(
      { error: "Forbidden — only the Grant Giver can respond to an extension request" },
      { status: 403 }
    );
  }

  // ── State validation ──────────────────────────────────────────────────────
  if (milestone.renegotiationStatus !== "EXTENSION_REQUESTED") {
    return NextResponse.json(
      { error: "No pending extension request for this milestone" },
      { status: 409 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { decision?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.decision || !["APPROVE", "REJECT"].includes(body.decision)) {
    return NextResponse.json(
      { error: "decision must be APPROVE or REJECT" },
      { status: 400 }
    );
  }

  const decision = body.decision as "APPROVE" | "REJECT";
  const { contract } = milestone;
  const startup = contract.startup;

  if (decision === "APPROVE") {
    // ── Approve: extend deadline, reset milestone to FUNDED ─────────────────
    const extensionDays = milestone.extensionDays ?? 14;
    const newCancelAfter = new Date(Date.now() + extensionDays * 24 * 60 * 60 * 1000);

    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: "FUNDED" as never,
        cancelAfter: newCancelAfter,
        renegotiationStatus: "EXTENSION_APPROVED",
        extensionApprovedAt: new Date(),
      },
    });

    // Determine new contract status based on remaining milestones
    const otherActive = contract.milestones.find(
      (m) => m.id !== milestoneId && !["PENDING", "COMPLETED", "EXPIRED"].includes(m.status)
    );
    const newContractStatus = otherActive ? otherActive.status : "FUNDED";
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: newContractStatus as never },
    });

    await writeAuditLog({
      contractId,
      milestoneId,
      event: "EXTENSION_APPROVED",
      actor: session.user.id,
      metadata: { extensionDays, newDeadline: newCancelAfter.toISOString() },
    });

    // Notify startup (fire-and-forget)
    if (startup) {
      sendExtensionApprovedEmail({
        to: startup.email,
        contractId,
        milestoneTitle: milestone.title,
        extensionDays,
        newDeadline: newCancelAfter,
      }).catch((err) => console.error("[email] sendExtensionApprovedEmail failed:", err));
    }

    return NextResponse.json({ ok: true, decision: "APPROVE", newDeadline: newCancelAfter.toISOString() });
  } else {
    // ── Reject: cancel escrow on-chain, set milestone EXPIRED ───────────────
    let txHash: string | undefined;
    try {
      txHash = await cancelMilestone(contractId, milestone.order);
    } catch (err) {
      console.error("[renegotiate/respond] cancelMilestone failed:", err);
      // If on-chain cancel fails (already cancelled, etc.) we still proceed with DB update
    }

    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: "EXPIRED" as never,
        renegotiationStatus: "EXTENSION_REJECTED",
        ...(txHash ? { evmTxHash: txHash } : {}),
      },
    });

    // Determine new contract status
    const remaining = contract.milestones.find(
      (m) => m.id !== milestoneId && !["PENDING", "COMPLETED", "EXPIRED"].includes(m.status)
    );
    const newContractStatus = remaining ? remaining.status : "EXPIRED";
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: newContractStatus as never },
    });

    await writeAuditLog({
      contractId,
      milestoneId,
      event: "EXTENSION_REJECTED",
      actor: session.user.id,
      metadata: { txHash },
    });

    // Notify startup (fire-and-forget)
    if (startup) {
      sendExtensionRejectedEmail({
        to: startup.email,
        contractId,
        milestoneTitle: milestone.title,
      }).catch((err) => console.error("[email] sendExtensionRejectedEmail failed:", err));
    }

    return NextResponse.json({ ok: true, decision: "REJECT" });
  }
}
