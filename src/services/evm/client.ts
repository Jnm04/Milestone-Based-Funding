import { ethers } from "ethers";

const RPC_URL =
  process.env.EVM_RPC_URL ?? "https://1449000.rpc.thirdweb.com";

function makeProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL, undefined, {
    staticNetwork: true,
    polling: false,
  });
}

export function getEVMProvider(): ethers.JsonRpcProvider {
  return makeProvider();
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
  return new ethers.Wallet(key, makeProvider());
}

/**
 * Wraps an async fn with exponential backoff retries.
 * Handles 429 / rate-limit errors from the public RPC.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delayMs = 3000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        msg.includes("429") ||
        msg.includes("Too Many Requests") ||
        msg.includes("exceeded maximum retry limit") ||
        msg.includes("SERVER_ERROR");
      if (!isRateLimit) throw err;
      const wait = delayMs * Math.pow(2, i);
      console.warn(`[evm] Rate limited, retrying in ${wait}ms… (attempt ${i + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
