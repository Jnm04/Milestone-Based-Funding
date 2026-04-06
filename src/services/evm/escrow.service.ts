import { ethers } from "ethers";
import { getEVMProvider, getPlatformSigner, withRetry } from "./client";
import { ESCROW_ABI, ERC20_ABI, toRLUSDUnits } from "@/lib/evm-abi";
import crypto from "crypto";

const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS!;
const RLUSD_CONTRACT = process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS!;

/**
 * Deterministically convert a DB contract id (string) to a bytes32 hash.
 * Uses keccak256 so it's always 32 bytes regardless of id length.
 */
export function contractIdToBytes32(contractId: string): string {
  return ethers.id(contractId);
}

/**
 * Generate a cryptographically random fulfillment key and its condition hash.
 * - fulfillment: 32 random bytes (hex string, server-side secret)
 * - condition:   keccak256(fulfillment) — stored on-chain in the escrow
 *
 * Trustless design: anyone who knows the fulfillment can call releaseMilestone.
 * The platform reveals it to the startup upon AI approval.
 */
export function generateFulfillment(): { fulfillment: string; condition: string } {
  const fulfillment = "0x" + crypto.randomBytes(32).toString("hex");
  const condition = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32"], [fulfillment]));
  return { fulfillment, condition };
}

/**
 * Build ABI-encoded calldata for RLUSD.approve(escrowContract, amount).
 * Returned as a hex string the frontend can pass directly to MetaMask.
 */
export function buildApproveCalldata(amountUSD: string): string {
  const iface = new ethers.Interface(ERC20_ABI);
  const amount = toRLUSDUnits(amountUSD);
  return iface.encodeFunctionData("approve", [ESCROW_CONTRACT, amount]);
}

/**
 * Build ABI-encoded calldata for MilestoneFundEscrow.fundMilestone(...).
 * Includes the condition (keccak256 of the fulfillment) for trustless release.
 */
export function buildFundMilestoneCalldata(params: {
  contractId: string;
  milestoneOrder: number;
  startupAddress: string;
  amountUSD: string;
  deadline: Date;
  condition: string;
}): string {
  const iface = new ethers.Interface(ESCROW_ABI);
  const contractIdHash = contractIdToBytes32(params.contractId);
  const amount = toRLUSDUnits(params.amountUSD);
  const deadline = BigInt(Math.floor(params.deadline.getTime() / 1000));
  return iface.encodeFunctionData("fundMilestone", [
    contractIdHash,
    params.milestoneOrder,
    params.startupAddress,
    amount,
    deadline,
    params.condition,
  ]);
}

/**
 * Release escrowed RLUSD to the startup by providing the fulfillment key.
 * The smart contract verifies keccak256(fulfillment) == stored condition.
 * Can be called by anyone who knows the fulfillment — no platform trust needed.
 */
export async function releaseMilestone(
  contractId: string,
  milestoneOrder: number,
  fulfillment: string
): Promise<string> {
  return withRetry(async () => {
    const signer = getPlatformSigner();
    const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, signer);
    const contractIdHash = contractIdToBytes32(contractId);
    const tx = await contract.releaseMilestone(contractIdHash, milestoneOrder, fulfillment);
    const receipt = await tx.wait();
    return receipt.hash;
  });
}

/**
 * Cancel an expired escrow and return RLUSD to the investor.
 * The investor can call this directly on-chain after the deadline without
 * needing platform involvement. This is a convenience wrapper for our cron job.
 */
export async function cancelMilestone(
  contractId: string,
  milestoneOrder: number
): Promise<string> {
  return withRetry(async () => {
    const signer = getPlatformSigner();
    const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, signer);
    const contractIdHash = contractIdToBytes32(contractId);
    const tx = await contract.cancelMilestone(contractIdHash, milestoneOrder);
    const receipt = await tx.wait();
    return receipt.hash;
  });
}

/**
 * Verify a fundMilestone transaction on-chain.
 * Returns ok=true if the tx was mined successfully and emitted MilestoneFunded
 * for the expected contractId.
 */
export async function verifyFundTx(txHash: string, contractId: string): Promise<{
  ok: boolean;
  milestoneOrder?: number;
}> {
  const provider = getEVMProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return { ok: false };

  const expectedContractIdHash = contractIdToBytes32(contractId);
  const iface = new ethers.Interface(ESCROW_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "MilestoneFunded") {
        if (parsed.args.contractId !== expectedContractIdHash) return { ok: false };
        return {
          ok: true,
          milestoneOrder: Number(parsed.args.milestoneOrder),
        };
      }
    } catch {
      // Non-matching log — skip
    }
  }

  return { ok: false };
}

/**
 * Check on-chain whether a milestone escrow is still active (funded, not yet
 * completed or cancelled). Used to guard cancel calls.
 */
export async function getMilestoneEscrowState(
  contractId: string,
  milestoneOrder: number
): Promise<{ funded: boolean; completed: boolean; cancelled: boolean }> {
  const provider = getEVMProvider();
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, provider);
  const contractIdHash = contractIdToBytes32(contractId);
  try {
    const state = await contract.getMilestoneEscrow(contractIdHash, milestoneOrder);
    return {
      funded: state.funded,
      completed: state.completed,
      cancelled: state.cancelled,
    };
  } catch {
    return { funded: false, completed: false, cancelled: false };
  }
}
