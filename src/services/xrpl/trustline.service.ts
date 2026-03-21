import { TrustSet, xrpToDrops } from "xrpl";

const RLUSD_ISSUER =
  process.env.RLUSD_ISSUER_ADDRESS ?? "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

const RLUSD_CURRENCY = "524C555344000000000000000000000000000000"; // "RLUSD" in 20-byte hex

/**
 * Builds a TrustSet transaction for RLUSD.
 * The investor/startup signs this via Xumm before any escrow operations.
 *
 * Limit is set to 1,000,000 RLUSD — sufficient for MVP.
 */
export function buildTrustSetTx(walletAddress: string): TrustSet {
  return {
    TransactionType: "TrustSet",
    Account: walletAddress,
    LimitAmount: {
      currency: RLUSD_CURRENCY,
      issuer: RLUSD_ISSUER,
      value: "1000000",
    },
  };
}

export { RLUSD_CURRENCY, RLUSD_ISSUER };
