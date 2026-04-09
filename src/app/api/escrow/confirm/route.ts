import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyFundTx } from "@/services/evm/escrow.service";
import { sendFundedEmail } from "@/lib/email";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { ethers } from "ethers";

/**
 * POST /api/escrow/confirm
 * Called after the frontend submits a fundMilestone transaction via MetaMask.
 * Verifies the transaction on-chain and marks the milestone/contract as FUNDED.
 *
 * Body: { contractId, txHash, milestoneId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { contractId, txHash, milestoneId } = await request.json();

    if (!contractId || !txHash) {
      return NextResponse.json(
        { error: "contractId and txHash are required" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { startup: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id) {
      return NextResponse.json({ error: "Not your contract" }, { status: 403 });
    }

    // Idempotent — already funded
    if (contract.status === "FUNDED") {
      return NextResponse.json({ ok: true, action: "already_funded" });
    }

    // Verify the transaction was mined successfully on-chain for this specific contract
    const { ok } = await verifyFundTx(txHash, contractId);
    if (!ok) {
      return NextResponse.json(
        { error: "Transaction not found or failed on-chain. Please wait and retry." },
        { status: 422 }
      );
    }

    let fundedMilestoneTitle = contract.milestone;
    let fundedAmountUSD = contract.amountUSD.toString();

    if (milestoneId) {
      const updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: "FUNDED", evmTxHash: txHash },
      });
      fundedMilestoneTitle = updatedMilestone.title;
      fundedAmountUSD = updatedMilestone.amountUSD.toString();

      // Check if all milestones are now funded
      const allMilestones = await prisma.milestone.findMany({
        where: { contractId },
        select: { status: true },
      });
      const allFunded = allMilestones.every((m) => m.status === "FUNDED");

      await prisma.contract.update({
        where: { id: contractId },
        data: {
          status: allFunded ? "FUNDED" : "AWAITING_ESCROW",
          evmTxHash: allFunded ? txHash : undefined,
        },
      });
    } else {
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: "FUNDED", evmTxHash: txHash },
      });
    }

    // keccak256 of the milestone title — anyone can verify the agreed criteria on-chain
    const milestoneHash = ethers.keccak256(ethers.toUtf8Bytes(fundedMilestoneTitle));

    await writeAuditLog({
      contractId,
      milestoneId: milestoneId ?? undefined,
      event: "ESCROW_FUNDED",
      actor: session.user.walletAddress ?? session.user.id,
      metadata: { txHash, amountUSD: fundedAmountUSD, milestoneHash },
    });

    // Email + webhook: milestone funded
    void fireWebhook({
      investorId: contract.investorId,
      startupId: contract.startupId ?? undefined,
      event: "contract.funded",
      contractId,
      milestoneId: milestoneId ?? undefined,
      data: { txHash, amountUSD: fundedAmountUSD, milestoneTitle: fundedMilestoneTitle },
    });

    if (contract.startup?.notifyFunded) {
      void sendFundedEmail({
        to: contract.startup.email,
        contractId,
        milestoneTitle: fundedMilestoneTitle,
        amountUSD: fundedAmountUSD,
        startupId: contract.startupId ?? undefined,
      });
    }

    return NextResponse.json({ ok: true, action: "funded" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow confirm error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
