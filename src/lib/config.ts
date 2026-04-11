/**
 * Platform network config.
 * Defaults to mainnet — the platform has been on XRPL Mainnet since the XLS-85 amendment (Feb 2026).
 * Override with XRPL_NETWORK=testnet for local development if needed.
 */
export const IS_MAINNET =
  process.env.XRPL_NETWORK !== "testnet" &&
  process.env.NEXT_PUBLIC_XRPL_NETWORK !== "testnet";
