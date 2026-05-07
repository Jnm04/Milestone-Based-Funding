import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  generateFulfillment,
  buildApproveCalldata,
  buildFundMilestoneCalldata,
} from "@/services/evm/escrow.service";
import { encryptFulfillment } from "@/lib/crypto";

const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS!;
const RLUSD_CONTRACT  = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;
const CHAIN_ID        = 1449000; // XRPL EVM Sidechain Testnet
const RPC_URL         = process.env.EVM_RPC_URL ?? "https://rpc.testnet.xrplevm.org";

/**
 * GET /api/agent/escrow-prepare
 *
 * Returns unsigned transaction calldata for the two-step escrow funding flow
 * (ERC-20 approve + fundMilestone) so agents can sign locally and broadcast
 * directly to the RPC without sending their private key to this server.
 *
 * After broadcasting both txs, call POST /api/escrow/sync with the txHash
 * to update the DB state.
 *
 * Query params: contractId (required) or milestoneId (optional)
 */
export async function GET(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  if (!(await checkRateLimit(`escrow-prepare:${apiKeyCtx.userId}`, 20, 60_000))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const contractId  = searchParams.get("contractId");
  const milestoneId = searchParams.get("milestoneId");

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

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.investorId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["DRAFT", "AWAITING_ESCROW"].includes(contract.status)) {
    return NextResponse.json(
      { error: `Contract status is ${contract.status}, expected AWAITING_ESCROW` },
      { status: 409 }
    );
  }

  const target = milestoneId
    ? contract.milestones.find((m) => m.id === milestoneId)
    : contract.milestones.find((m) => ["AWAITING_ESCROW", "PENDING"].includes(m.status));

  if (!target) {
    return NextResponse.json({ error: "No fundable milestone found" }, { status: 409 });
  }

  const startupAddress = contract.startup?.walletAddress;
  if (!startupAddress) {
    return NextResponse.json(
      { error: "Startup has no wallet address — cannot prepare on-chain escrow" },
      { status: 422 }
    );
  }

  // Generate fulfillment/condition pair and persist encrypted fulfillment now
  // so we can release escrow later even if the agent never calls /escrow/sync.
  const { fulfillment, condition } = generateFulfillment();
  const encryptedFulfillment = encryptFulfillment(fulfillment);

  await prisma.milestone.update({
    where: { id: target.id },
    data: { escrowFulfillment: encryptedFulfillment },
  });

  const amountUSD = Number(target.amountUSD).toString();

  const approveCalldata   = buildApproveCalldata(amountUSD);
  const fundCalldata      = buildFundMilestoneCalldata({
    contractId:     resolvedContractId,
    milestoneOrder: target.order,
    startupAddress,
    amountUSD,
    deadline:       target.cancelAfter,
    condition,
  });

  return NextResponse.json({
    contractId:  resolvedContractId,
    milestoneId: target.id,
    amountUSD:   Number(target.amountUSD).toFixed(2),
    chainId:     CHAIN_ID,
    rpcUrl:      RPC_URL,
    // Step 1: approve RLUSD spend
    approveTx: {
      to:   RLUSD_CONTRACT,
      data: approveCalldata,
    },
    // Step 2: fund milestone escrow
    fundTx: {
      to:   ESCROW_CONTRACT,
      data: fundCalldata,
    },
    // After broadcasting both txs, call:
    //   POST /api/escrow/sync  { contractId, milestoneId }
    // to update DB state.
  });
}
