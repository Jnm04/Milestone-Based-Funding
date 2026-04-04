import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import {
  buildApproveCalldata,
  buildFundMilestoneCalldata,
} from "@/services/evm/escrow.service";

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

      // Store the RLUSD amount on the milestone for display
      await prisma.milestone.update({
        where: { id: milestoneId },
        data: { amountRLUSD: amountUSD },
      });
    } else {
      amountUSD = contract.amountUSD.toString();
      deadline = contract.cancelAfter;
      milestoneOrder = 0;

      await prisma.contract.update({
        where: { id: contractId },
        data: { amountRLUSD: amountUSD },
      });
    }

    const approveCalldata = buildApproveCalldata(amountUSD);
    const fundCalldata = buildFundMilestoneCalldata({
      contractId,
      milestoneOrder,
      startupAddress: contract.startup.walletAddress,
      amountUSD,
      deadline,
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Escrow create error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
