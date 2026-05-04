import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { ethers } from "ethers";
import { ESCROW_ABI, ERC20_ABI, toRLUSDUnits } from "@/lib/evm-abi";
import { generateFulfillment, contractIdToBytes32 } from "@/services/evm/escrow.service";
import { encryptFulfillment } from "@/lib/crypto";

const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS!;
const RLUSD_CONTRACT = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;
const RPC_URL = process.env.EVM_RPC_URL ?? "https://rpc.testnet.xrplevm.org";

// POST /api/agent/escrow-fund
// Agent-only: approve RLUSD + fund escrow on-chain using the agent's own private key.
// The agent must provide their EVM private key — funds come from their wallet.
export async function POST(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized — API key required" }, { status: 401 });
  }

  let body: { contractId?: string; milestoneId?: string; agentPrivateKey?: string; amountUSD?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contractId, milestoneId, agentPrivateKey, amountUSD } = body;
  if (!agentPrivateKey) {
    return NextResponse.json({ error: "agentPrivateKey is required" }, { status: 400 });
  }
  if (!contractId && !milestoneId) {
    return NextResponse.json({ error: "contractId or milestoneId is required" }, { status: 400 });
  }

  const resolvedContractId = contractId ?? (
    await prisma.milestone.findUnique({ where: { id: milestoneId! }, select: { contractId: true } })
  )?.contractId;

  if (!resolvedContractId) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: resolvedContractId },
    include: { milestones: { orderBy: { order: "asc" } }, startup: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.investorId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["DRAFT", "AWAITING_ESCROW"].includes(contract.status)) {
    return NextResponse.json({ error: `Contract status is ${contract.status}, expected AWAITING_ESCROW` }, { status: 409 });
  }

  const target = milestoneId
    ? contract.milestones.find((m) => m.id === milestoneId)
    : contract.milestones.find((m) => ["AWAITING_ESCROW", "PENDING"].includes(m.status));

  if (!target) {
    return NextResponse.json({ error: "No fundable milestone found" }, { status: 409 });
  }

  const fundAmountUSD = amountUSD ?? Number(target.amountUSD);
  if (fundAmountUSD <= 0) {
    return NextResponse.json({ error: "Milestone amountUSD must be > 0 for real escrow" }, { status: 400 });
  }

  // Startup wallet address required for on-chain escrow
  const startupAddress = contract.startup?.walletAddress;
  if (!startupAddress) {
    return NextResponse.json({ error: "Startup has no wallet address — cannot fund on-chain escrow" }, { status: 422 });
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const agentWallet = new ethers.Wallet(agentPrivateKey, provider);

    const rlusd = new ethers.Contract(RLUSD_CONTRACT, ERC20_ABI, agentWallet);
    const escrow = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, agentWallet);

    const amount = toRLUSDUnits(fundAmountUSD.toString());
    const deadline = BigInt(Math.floor(target.cancelAfter.getTime() / 1000));
    const contractIdHash = contractIdToBytes32(resolvedContractId);
    const { fulfillment, condition } = generateFulfillment();

    // Step 1: approve
    const approveTx = await rlusd.approve(ESCROW_CONTRACT, amount);
    await approveTx.wait();

    // Step 2: fund milestone on-chain
    const fundTx = await escrow.fundMilestone(
      contractIdHash,
      target.order,
      startupAddress,
      amount,
      deadline,
      condition,
    );
    const receipt = await fundTx.wait();
    const txHash: string = receipt.hash;

    // Persist to DB
    const encryptedFulfillment = encryptFulfillment(fulfillment);
    await prisma.$transaction([
      prisma.milestone.update({
        where: { id: target.id },
        data: { status: "FUNDED", evmTxHash: txHash, escrowFulfillment: encryptedFulfillment },
      }),
      prisma.contract.update({
        where: { id: resolvedContractId },
        data: { status: "FUNDED", evmTxHash: txHash, escrowFulfillment: encryptedFulfillment },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      milestoneId: target.id,
      contractId: resolvedContractId,
      txHash,
      amountUSD: fundAmountUSD,
      status: "FUNDED",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[escrow-fund] Failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
