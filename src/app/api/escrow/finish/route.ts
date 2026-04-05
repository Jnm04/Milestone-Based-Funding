import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { releaseMilestone } from "@/services/evm/escrow.service";
import { sendVerifiedEmail, sendMilestoneCompletedInvestorEmail } from "@/lib/email";

/**
 * POST /api/escrow/finish
 * Platform wallet calls releaseMilestone() on the EVM smart contract,
 * transferring RLUSD to the startup. No user signing required.
 *
 * Body: { contractId, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId, milestoneId } = await request.json();

    if (!contractId) {
      return NextResponse.json({ error: "contractId is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { milestones: true, investor: true, startup: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id && contract.startupId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status === "COMPLETED") {
      return NextResponse.json({ ok: true, action: "already_completed" });
    }

    if (contract.status !== "VERIFIED") {
      return NextResponse.json(
        { error: `Expected VERIFIED, got ${contract.status}` },
        { status: 409 }
      );
    }

    let milestoneOrder: number;

    if (milestoneId) {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.status !== "VERIFIED") {
        return NextResponse.json(
          { error: `Expected milestone in VERIFIED, got ${milestone.status}` },
          { status: 409 }
        );
      }
      milestoneOrder = milestone.order;
    } else {
      milestoneOrder = 0;
    }

    // Platform wallet releases funds on-chain — no user signing needed
    const txHash = await releaseMilestone(contractId, milestoneOrder);
    console.log("[escrow/finish] Released on-chain:", txHash);

    if (milestoneId) {
      const completedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "COMPLETED", evmTxHash: txHash },
        include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
      });

      const milestones = completedMilestone.contract.milestones;
      const remaining = milestones.find(
        (m) => m.id !== milestoneId && !["COMPLETED", "EXPIRED"].includes(m.status)
      );

      let nextContractStatus: string;
      if (!remaining) {
        nextContractStatus = "COMPLETED";
      } else if (remaining.status === "FUNDED") {
        nextContractStatus = "FUNDED";
      } else {
        nextContractStatus = "AWAITING_ESCROW";
      }

      await prisma.contract.update({
        where: { id: contractId },
        data: { status: nextContractStatus as never },
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "COMPLETED" },
      });
    }

    const completedTitle = milestoneId
      ? contract.milestones.find((m) => m.id === milestoneId)?.title ?? contract.milestone
      : contract.milestone;
    const completedAmount = milestoneId
      ? (contract.milestones.find((m) => m.id === milestoneId)?.amountUSD ?? contract.amountUSD).toString()
      : contract.amountUSD.toString();

    if (contract.startup?.notifyVerified) {
      void sendVerifiedEmail({
        to: contract.startup.email,
        contractId,
        milestoneTitle: completedTitle,
        amountUSD: completedAmount,
        txHash,
      });
    }

    if (contract.investor.notifyMilestoneCompleted) {
      void sendMilestoneCompletedInvestorEmail({
        to: contract.investor.email,
        contractId,
        milestoneTitle: completedTitle,
        amountUSD: completedAmount,
      });
    }

    return NextResponse.json({ ok: true, action: "completed", txHash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow finish error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
