import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";
import { sendManualApprovedEmail, sendFulfillmentKeyEmail, sendVerifiedEmail } from "@/lib/email";
import { decryptFulfillment } from "@/lib/crypto";
import { contractIdToBytes32, releaseMilestone } from "@/services/evm/escrow.service";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const apiKeyCtx = !session ? await resolveApiKey(request.headers.get("authorization")) : null;

    // Session path: must be INVESTOR role
    if (session && session.user.role !== "INVESTOR") {
      return NextResponse.json({ error: "Investor access required" }, { status: 403 });
    }

    if (!session && !apiKeyCtx) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // API-key path: also enforce INVESTOR role
    if (apiKeyCtx) {
      const apiUser = await prisma.user.findUnique({
        where: { id: apiKeyCtx.userId },
        select: { role: true },
      });
      if (apiUser?.role !== "INVESTOR") {
        return NextResponse.json({ error: "Investor access required" }, { status: 403 });
      }
    }

    const actorId = session?.user?.id ?? apiKeyCtx!.userId;
    const isAgent = !!apiKeyCtx;

    // M-6: Rate limit for ALL callers (previously only agents were limited)
    if (!(await checkRateLimit(`contract-review:${actorId}`, 20, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json() as { contractId?: string; decision?: string };
    const { contractId, decision } = body;

    if (!contractId || !["APPROVE", "REJECT"].includes(decision ?? "")) {
      return NextResponse.json({ error: "contractId and decision (APPROVE|REJECT) required" }, { status: 400 });
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, deletedAt: null },
      include: {
        investor: true,
        startup: true,
        milestones: { where: { status: "PENDING_REVIEW" } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investor.id !== actorId) {
      return NextResponse.json({ error: "Not your contract" }, { status: 403 });
    }

    // Agent-only guard: agent contracts with AUTO mode never reach PENDING_REVIEW,
    // so this endpoint only makes sense for MANUAL or MANUAL_AUTO modes.
    if (isAgent && contract.agentReviewMode === "AUTO") {
      return NextResponse.json(
        { error: "This contract uses AUTO review mode — manual review is disabled. Set agentReviewMode to MANUAL or MANUAL_AUTO when creating the contract." },
        { status: 409 }
      );
    }

    if (contract.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Contract is not pending review" }, { status: 409 });
    }

    const newStatus = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    const now = new Date();

    if (decision === "REJECT" && contract.milestones.length > 0) {
      const MAX_EXTENSION_MS = 30 * 24 * 60 * 60 * 1000;
      for (const milestone of contract.milestones) {
        const reviewDurationMs = Math.min(
          Math.max(0, now.getTime() - milestone.updatedAt.getTime()),
          MAX_EXTENSION_MS
        );
        const newCancelAfter = new Date(milestone.cancelAfter.getTime() + reviewDurationMs);

        await prisma.milestone.update({
          where: { id: milestone.id },
          data: { status: "REJECTED", cancelAfter: newCancelAfter },
        });

        await writeAuditLog({
          contractId,
          milestoneId: milestone.id,
          event: "MANUAL_REVIEW_REJECTED",
          actor: actorId,
          metadata: {
            reviewDurationDays: Math.round(reviewDurationMs / (1000 * 60 * 60 * 24) * 10) / 10,
            deadlineExtendedTo: newCancelAfter.toISOString(),
            byAgent: isAgent,
          },
        });
      }

      const firstMilestone = contract.milestones[0];
      const reviewDurationMs = Math.min(
        Math.max(0, now.getTime() - firstMilestone.updatedAt.getTime()),
        MAX_EXTENSION_MS
      );
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "REJECTED", cancelAfter: new Date(contract.cancelAfter.getTime() + reviewDurationMs) },
      });

      return NextResponse.json({ status: "REJECTED" });
    }

    // ── APPROVE ──────────────────────────────────────────────────────────────
    // Agent APPROVE: auto-release funds on-chain immediately (same as verify auto-release).
    // Human APPROVE: set VERIFIED so the Builder can trigger escrow/finish via the UI.
    if (isAgent) {
      const pendingMilestone = contract.milestones[0] ?? null;
      const milestoneTitle = pendingMilestone?.title ?? contract.milestone;
      const amountUSD = (pendingMilestone?.amountUSD ?? contract.amountUSD).toString();
      const milestoneOrder = pendingMilestone?.order ?? 0;
      const rawFulfillment = pendingMilestone?.escrowFulfillment ?? contract.escrowFulfillment;

      if (!rawFulfillment) {
        return NextResponse.json({ error: "Fulfillment key not found — cannot release escrow" }, { status: 500 });
      }

      const txHash = await releaseMilestone(contractId, milestoneOrder, decryptFulfillment(rawFulfillment));

      if (pendingMilestone) {
        const completedMilestone = await prisma.milestone.update({
          where: { id: pendingMilestone.id },
          data: { status: "COMPLETED", evmTxHash: txHash, escrowFulfillment: null },
          include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
        });
        const milestones = completedMilestone.contract.milestones;
        const remaining = milestones.find(
          (m) => m.id !== pendingMilestone.id && !["COMPLETED", "EXPIRED"].includes(m.status)
        );
        const nextStatus = !remaining ? "COMPLETED" : remaining.status === "FUNDED" ? "FUNDED" : "AWAITING_ESCROW";
        await prisma.contract.update({ where: { id: contractId }, data: { status: nextStatus as never } });
      } else {
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: "COMPLETED", escrowFulfillment: null },
        });
      }

      await writeAuditLog({
        contractId,
        milestoneId: pendingMilestone?.id,
        event: "MANUAL_REVIEW_APPROVED",
        actor: actorId,
        metadata: { byAgent: true, auto: false },
      });
      await writeAuditLog({
        contractId,
        milestoneId: pendingMilestone?.id,
        event: "FUNDS_RELEASED",
        metadata: { txHash, amountUSD, auto: false, byAgent: true },
      });

      if (contract.startup?.notifyVerified && contract.startup.email) {
        sendVerifiedEmail({
          to: contract.startup.email,
          contractId,
          milestoneTitle,
          amountUSD,
          txHash,
        }).catch((err) => console.error("[email] sendVerifiedEmail failed:", err));
      }

      return NextResponse.json({ status: "COMPLETED", txHash });
    }

    // Human APPROVE — set VERIFIED, Builder triggers escrow/finish via UI
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
      actor: actorId,
    });

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

      const rawFulfillment = pendingMilestone?.escrowFulfillment ?? contract.escrowFulfillment;
      const milestoneOrder = pendingMilestone?.order ?? 0;
      if (rawFulfillment) {
        const fulfillment = decryptFulfillment(rawFulfillment);
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

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error("Review error:", err);
    return NextResponse.json({ error: "Review failed" }, { status: 500 });
  }
}
