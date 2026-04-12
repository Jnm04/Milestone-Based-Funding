import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";
import { sendManualApprovedEmail, sendFulfillmentKeyEmail } from "@/lib/email";
import { contractIdToBytes32 } from "@/services/evm/escrow.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "INVESTOR") {
      return NextResponse.json({ error: "Investor access required" }, { status: 403 });
    }

    const { contractId, decision } = await request.json();

    if (!contractId || !["APPROVE", "REJECT"].includes(decision)) {
      return NextResponse.json({ error: "contractId and decision (APPROVE|REJECT) required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        investor: true,
        startup: true,
        milestones: { where: { status: "PENDING_REVIEW" } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investor.id !== session.user.id) {
      return NextResponse.json({ error: "Not your contract" }, { status: 403 });
    }

    if (contract.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Contract is not pending review" }, { status: 409 });
    }

    const newStatus = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    const now = new Date();

    if (decision === "REJECT" && contract.milestones.length > 0) {
      // Extend each rejected milestone's deadline by however long the review took.
      // The milestone's updatedAt records when it entered PENDING_REVIEW.
      for (const milestone of contract.milestones) {
        const reviewDurationMs = now.getTime() - milestone.updatedAt.getTime();
        const newCancelAfter = new Date(milestone.cancelAfter.getTime() + reviewDurationMs);

        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { status: "REJECTED", cancelAfter: newCancelAfter },
        });

        await writeAuditLog({
          contractId,
          milestoneId: milestone.id,
          event: "MANUAL_REVIEW_REJECTED",
          actor: session.user.id,
          metadata: {
            reviewDurationDays: Math.round(reviewDurationMs / (1000 * 60 * 60 * 24) * 10) / 10,
            deadlineExtendedTo: newCancelAfter.toISOString(),
          },
        });
      }

      // Extend contract deadline by the same duration as the first milestone
      const firstMilestone = contract.milestones[0];
      const reviewDurationMs = now.getTime() - firstMilestone.updatedAt.getTime();
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "REJECTED", cancelAfter: new Date(contract.cancelAfter.getTime() + reviewDurationMs) },
      });
    } else {
      // APPROVE — no deadline change needed
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: newStatus },
      });

      await prisma.milestone.updateMany({
        where: { contractId, status: "PENDING_REVIEW" },
        data: { status: newStatus as never },
      });

      await writeAuditLog({
        contractId,
        event: "MANUAL_REVIEW_APPROVED",
        actor: session.user.id,
      });

      // Notify startup: their proof was approved, they can now release funds
      if (contract.startup?.email && contract.startup.notifyVerified) {
        const pendingMilestone = contract.milestones[0] ?? null;
        const milestoneTitle = pendingMilestone?.title ?? contract.milestone;
        const amountUSD = (pendingMilestone?.amountUSD ?? contract.amountUSD).toString();

        sendManualApprovedEmail({
          to: contract.startup.email,
          contractId,
          milestoneTitle,
          amountUSD,
          startupId: contract.startupId ?? undefined,
        }).catch((err) => console.error("[email] sendManualApprovedEmail failed:", err));

        // Send fulfillment key as trustless backup
        const fulfillment = pendingMilestone?.escrowFulfillment ?? contract.escrowFulfillment;
        const milestoneOrder = pendingMilestone?.order ?? 0;
        if (fulfillment) {
          sendFulfillmentKeyEmail({
            to: contract.startup.email,
            contractId,
            milestoneTitle,
            fulfillment,
            contractIdHash: contractIdToBytes32(contractId),
            milestoneOrder,
          }).catch((err) => console.error("[email] sendFulfillmentKeyEmail failed:", err));
        }
      }
    }

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error("Review error:", err);
    return NextResponse.json({ error: "Review failed" }, { status: 500 });
  }
}
