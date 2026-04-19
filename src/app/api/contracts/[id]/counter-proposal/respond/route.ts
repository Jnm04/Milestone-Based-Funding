import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  sendCounterProposalRespondedEmail,
} from "@/lib/email";
import type { MilestoneChange } from "../route";

/**
 * POST /api/contracts/[id]/counter-proposal/respond
 *
 * Investor accepts or rejects the startup's counter-proposal.
 * Body: { decision: "ACCEPT" | "REJECT" }
 *
 * ACCEPT:
 *   - Apply proposed milestone term changes
 *   - Set contract.startupId = counterProposal.proposedBy
 *   - Advance contract to AWAITING_ESCROW (same as join)
 *   - Advance all milestones to AWAITING_ESCROW
 *   - Mark counter-proposal as ACCEPTED
 *
 * REJECT:
 *   - Mark counter-proposal as REJECTED
 *   - Original invite link remains active (startup can still accept original terms)
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "INVESTOR") {
      return NextResponse.json({ error: "Only grant givers can respond to counter-proposals" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { decision } = body as { decision?: string };
    if (decision !== "ACCEPT" && decision !== "REJECT") {
      return NextResponse.json({ error: "decision must be ACCEPT or REJECT" }, { status: 400 });
    }

    // Load contract
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        milestones: { select: { id: true, title: true, amountUSD: true, cancelAfter: true, order: true } },
        startup: { select: { email: true, name: true, companyName: true, walletAddress: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Counter-proposals can only be responded to while the contract is in DRAFT status" },
        { status: 409 }
      );
    }

    // Load counter-proposal
    const cp = await prisma.counterProposal.findUnique({
      where: { contractId: id },
    });

    if (!cp) {
      return NextResponse.json({ error: "No counter-proposal found for this contract" }, { status: 404 });
    }

    if (cp.status !== "PENDING") {
      return NextResponse.json(
        { error: "This counter-proposal has already been responded to" },
        { status: 409 }
      );
    }

    // Load startup user for email/wallet data
    const startupUser = await prisma.user.findUnique({
      where: { id: cp.proposedBy },
      select: { email: true, name: true, companyName: true, walletAddress: true },
    });

    if (!startupUser) {
      return NextResponse.json({ error: "Startup user not found" }, { status: 404 });
    }

    const now = new Date();

    if (decision === "REJECT") {
      await prisma.counterProposal.update({
        where: { contractId: id },
        data: { status: "REJECTED", respondedAt: now },
      });

      // Notify startup
      sendCounterProposalRespondedEmail({
        to: startupUser.email,
        contractId: id,
        contractTitle: contract.milestone,
        decision: "REJECTED",
        investorName: session.user.name ?? null,
      }).catch(() => {});

      return NextResponse.json({ success: true, decision: "REJECTED" });
    }

    // ── ACCEPT ────────────────────────────────────────────────────────────────

    const changes = (cp.milestoneChanges as unknown as MilestoneChange[]) ?? [];

    // Build milestone update operations
    const milestoneUpdates = changes
      .filter((mc) => mc.newAmountUSD !== undefined || mc.newCancelAfter !== undefined)
      .map((mc) => {
        const data: { amountUSD?: string; cancelAfter?: Date } = {};
        if (mc.newAmountUSD !== undefined) {
          const parsed = parseFloat(mc.newAmountUSD);
          if (!isNaN(parsed) && parsed > 0) {
            data.amountUSD = mc.newAmountUSD;
          }
        }
        if (mc.newCancelAfter !== undefined) {
          const d = new Date(mc.newCancelAfter);
          if (!isNaN(d.getTime()) && d > new Date()) {
            data.cancelAfter = d;
          }
        }
        return { id: mc.milestoneId, data };
      })
      .filter((op) => Object.keys(op.data).length > 0);

    // Apply all changes in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Apply milestone term changes
      for (const op of milestoneUpdates) {
        await tx.milestone.update({
          where: { id: op.id },
          data: op.data,
        });
      }

      // 2. Recalculate contract amountUSD as sum of milestone amounts
      const updatedMilestones = await tx.milestone.findMany({
        where: { contractId: id },
        select: { amountUSD: true },
      });
      const totalUSD = updatedMilestones.reduce(
        (sum, m) => sum + parseFloat(m.amountUSD.toString()),
        0
      );

      // 3. Use the latest deadline among milestones as the contract cancelAfter
      const allMilestones = await tx.milestone.findMany({
        where: { contractId: id },
        select: { cancelAfter: true },
        orderBy: { cancelAfter: "desc" },
      });
      const latestDeadline = allMilestones[0]?.cancelAfter ?? contract.cancelAfter;

      // 4. Advance contract: assign startup + AWAITING_ESCROW
      await tx.contract.update({
        where: { id },
        data: {
          startupId: cp.proposedBy,
          status: "AWAITING_ESCROW",
          amountUSD: totalUSD,
          cancelAfter: latestDeadline,
        },
      });

      // 5. Advance all milestones to AWAITING_ESCROW
      await tx.milestone.updateMany({
        where: { contractId: id },
        data: { status: "AWAITING_ESCROW" },
      });

      // 6. Mark counter-proposal as ACCEPTED
      await tx.counterProposal.update({
        where: { contractId: id },
        data: { status: "ACCEPTED", respondedAt: now },
      });
    });

    // Notify startup (non-blocking)
    sendCounterProposalRespondedEmail({
      to: startupUser.email,
      contractId: id,
      contractTitle: contract.milestone,
      decision: "ACCEPTED",
      investorName: session.user.name ?? null,
    }).catch(() => {});

    return NextResponse.json({ success: true, decision: "ACCEPTED" });
  } catch (err) {
    console.error("[counter-proposal/respond] Error:", err);
    return NextResponse.json({ error: "Failed to respond to counter-proposal" }, { status: 500 });
  }
}
