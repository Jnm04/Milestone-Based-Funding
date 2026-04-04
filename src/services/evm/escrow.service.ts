import { ethers } from "ethers";
import { getEVMProvider, getPlatformSigner } from "./client";
import { ESCROW_ABI, ERC20_ABI, toRLUSDUnits } from "@/lib/evm-abi";

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
 */
export function buildFundMilestoneCalldata(params: {
  contractId: string;
  milestoneOrder: number;
  startupAddress: string;
  amountUSD: string;
  deadline: Date;
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
  ]);
}

/**
 * Platform wallet calls releaseMilestone — sends RLUSD to the startup.
 * No user signing required.
 */
export async function releaseMilestone(
  contractId: string,
  milestoneOrder: number
): Promise<string> {
  const signer = getPlatformSigner();
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, signer);
  const contractIdHash = contractIdToBytes32(contractId);
  const tx = await contract.releaseMilestone(contractIdHash, milestoneOrder);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Platform wallet calls cancelMilestone — returns RLUSD to the investor.
 * Only succeeds after the milestone deadline has passed.
 */
export async function cancelMilestone(
  contractId: string,
  milestoneOrder: number
): Promise<string> {
  const signer = getPlatformSigner();
  const contract = new ethers.Contract(ESCROW_CONTRACT, ESCROW_ABI, signer);
  const contractIdHash = contractIdToBytes32(contractId);
  const tx = await contract.cancelMilestone(contractIdHash, milestoneOrder);
  const receipt = await tx.wait();
  return receipt.hash;
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
        // Verify the event belongs to this specific contract
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
