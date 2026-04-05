/**
 * EVM contract ABIs and amount helpers for MilestoneFundEscrow + RLUSD.
 * The full ABI is in artifacts/ after `npx hardhat compile`.
 * We only include the function signatures needed by the Next.js app here.
 */

export const ESCROW_ABI = [
  "function fundMilestone(bytes32 contractId, uint256 milestoneOrder, address startup, uint256 amount, uint256 deadline) external",
  "function releaseMilestone(bytes32 contractId, uint256 milestoneOrder) external",
  "function cancelMilestone(bytes32 contractId, uint256 milestoneOrder) external",
  "function getMilestoneEscrow(bytes32 contractId, uint256 milestoneOrder) external view returns (tuple(address investor, address startup, uint256 amount, uint256 deadline, bool funded, bool completed, bool cancelled))",
  "event MilestoneFunded(bytes32 indexed contractId, uint256 indexed milestoneOrder, address indexed investor, uint256 amount)",
  "event MilestoneReleased(bytes32 indexed contractId, uint256 indexed milestoneOrder, address startup, uint256 amount)",
  "event MilestoneCancelled(bytes32 indexed contractId, uint256 indexed milestoneOrder, address investor, uint256 amount)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function faucet(uint256 amount) external",
] as const;

/** RLUSD uses 6 decimal places (same as USDC on Ethereum). */
export const RLUSD_DECIMALS = 6;

/**
 * Convert a USD amount string (e.g. "500.00") to RLUSD token units (bigint).
 * $1.00 = 1_000_000 units.
 */
export function toRLUSDUnits(usdAmount: string): bigint {
  const [whole = "0", fraction = ""] = usdAmount.split(".");
  const paddedFraction = fraction.padEnd(RLUSD_DECIMALS, "0").slice(0, RLUSD_DECIMALS);
  return BigInt(whole) * BigInt(10 ** RLUSD_DECIMALS) + BigInt(paddedFraction);
}

/** Convert RLUSD token units back to a human-readable string (e.g. "500.000000"). */
export function fromRLUSDUnits(units: bigint): string {
  const divisor = BigInt(10 ** RLUSD_DECIMALS);
  const whole = units / divisor;
  const fraction = units % divisor;
  return `${whole}.${fraction.toString().padStart(RLUSD_DECIMALS, "0")}`;
}

export const XRPL_EVM_CHAIN_ID = 1449000;
