import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  buildApproveCalldata,
  buildFundMilestoneCalldata,
  generateFulfillment,
} from "@/services/evm/escrow.service";
import { encryptFulfillment, decryptFulfillment } from "@/lib/crypto";

const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS!;
const RLUSD_CONTRACT = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;

/**
 * POST /api/escrow/create
 * Returns pre-encoded EVM calldata for MetaMask to:
 *   1. Approve RLUSD spending by the escrow contract
 *   2. Call fundMilestone on the escrow contract
 *
 * The frontend sends both transactions via window.ethereum, then confirms
 * the funding by calling POST /api/escrow/confirm with the tx hash.
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
      include: { investor: true, startup: true, milestones: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (contract.status !== "AWAITING_ESCROW") {
      return NextResponse.json(
        { error: `Expected AWAITING_ESCROW, got ${contract.status}` },
        { status: 409 }
      );
    }

    if (!contract.startup?.walletAddress) {
      return NextResponse.json({ error: "No startup has joined yet" }, { status: 409 });
    }

    let amountUSD: string;
    let deadline: Date;
    let milestoneOrder: number;

    if (milestoneId) {
      const milestone = contract.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
      }
      if (milestone.status !== "AWAITING_ESCROW") {
        return NextResponse.json(
          { error: `Expected milestone in AWAITING_ESCROW, got ${milestone.status}` },
          { status: 409 }
        );
      }
      amountUSD = milestone.amountUSD.toString();
      deadline = milestone.cancelAfter;
      milestoneOrder = milestone.order;

    } else {
      amountUSD = contract.amountUSD.toString();
      deadline = contract.cancelAfter;
      milestoneOrder = 0;
    }

    // Reuse an existing fulfillment if one was already generated for this escrow.
    // This prevents a mismatch between the on-chain condition (set when the investor
    // first signed fundMilestone) and the DB fulfillment (which would be overwritten
    // if the user retried after a failed confirm step).
    let fulfillment: string;
    let condition: string;

    const existingFulfillment = milestoneId
      ? contract.milestones.find((m) => m.id === milestoneId)?.escrowFulfillment
      : contract.escrowFulfillment;

    if (existingFulfillment) {
      // Recompute condition from the stored fulfillment so both are always in sync.
      const { ethers: ethersLib } = await import("ethers");
      fulfillment = decryptFulfillment(existingFulfillment);
      condition = ethersLib.keccak256(
        ethersLib.AbiCoder.defaultAbiCoder().encode(["bytes32"], [fulfillment])
      );
    } else {
      ({ fulfillment, condition } = generateFulfillment());

      if (milestoneId) {
        await prisma.milestone.update({
          where: { id: milestoneId },
          data: { amountRLUSD: amountUSD, escrowFulfillment: encryptFulfillment(fulfillment), escrowCondition: condition },
        });
      } else {
        await prisma.contract.update({
          where: { id: contractId },
          data: { amountRLUSD: amountUSD, escrowFulfillment: encryptFulfillment(fulfillment), escrowCondition: condition },
        });
      }
    }

    const approveCalldata = buildApproveCalldata(amountUSD);
    const fundCalldata = buildFundMilestoneCalldata({
      contractId,
      milestoneOrder,
      startupAddress: contract.startup.walletAddress,
      amountUSD,
      deadline,
      condition,
    });

    return NextResponse.json({
      rlusdAddress: RLUSD_CONTRACT,
      escrowContractAddress: ESCROW_CONTRACT,
      approveCalldata,
      fundCalldata,
      amountUSD,
      milestoneOrder,
    });
  } catch (err) {
    console.error("Escrow create error:", err);
    return NextResponse.json({ error: "Escrow create failed" }, { status: 500 });
  }
}
