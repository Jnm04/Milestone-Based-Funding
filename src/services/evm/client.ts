import { ethers } from "ethers";

const RPC_URL =
  process.env.EVM_RPC_URL ?? "https://1449000.rpc.thirdweb.com";

let provider: ethers.JsonRpcProvider | null = null;
let platformSigner: ethers.Wallet | null = null;

export function getEVMProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return provider;
}

/**
 * Returns a Wallet connected to the EVM provider, funded by the platform's
 * private key. Used to call releaseMilestone / cancelMilestone server-side
 * without requiring user interaction.
 */
export function getPlatformSigner(): ethers.Wallet {
  const key = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      "PLATFORM_WALLET_PRIVATE_KEY is not set — required to release/cancel escrow"
    );
  }
  if (!platformSigner) {
    platformSigner = new ethers.Wallet(key, getEVMProvider());
  }
  return platformSigner;
}
