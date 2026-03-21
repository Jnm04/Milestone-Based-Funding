import { EscrowCreate, EscrowFinish, EscrowCancel, unixTimeToRippleTime } from "xrpl";
import { RLUSD_CURRENCY, RLUSD_ISSUER } from "./trustline.service";
import { getXRPLClient } from "./client";

/** True when running against XRPL Testnet (default for local dev). */
export function isTestnet(): boolean {
  return process.env.NEXT_PUBLIC_XRPL_NETWORK !== "mainnet";
}

/**
 * Returns the correct escrow Amount for the current network.
 * - Testnet: XRP drops (string) — 1 USD = 1 XRP = 1,000,000 drops
 * - Mainnet: RLUSD IOU object (XLS-85)
 */
export function buildEscrowAmount(
  amountUSD: string
): string | { currency: string; issuer: string; value: string } {
  if (isTestnet()) {
    const drops = Math.round(parseFloat(amountUSD) * 1_000_000).toString();
    return drops;
  }
  return { currency: RLUSD_CURRENCY, issuer: RLUSD_ISSUER, value: amountUSD };
}

export interface CreateEscrowParams {
  investorAddress: string;
  startupAddress: string;
  amountRLUSD: string;       // e.g. "500.00" (treated as XRP on testnet)
  condition: string;          // hex-encoded crypto-condition
  cancelAfterDate: Date;      // deadline
}

export interface FinishEscrowParams {
  investorAddress: string;   // Account that created the escrow
  escrowSequence: number;    // EscrowCreate sequence number
  fulfillment: string;        // hex-encoded fulfillment
  condition: string;          // hex-encoded condition
}

export interface CancelEscrowParams {
  callerAddress: string;     // Any account can cancel after deadline
  investorAddress: string;   // Owner of the escrow
  escrowSequence: number;
}

/**
 * Builds an EscrowCreate transaction for RLUSD.
 * The investor signs this via Xumm.
 *
 * Note: Amount uses the IOU format for RLUSD (trustline token).
 * XRPL XLS-85 amendment (live Feb 2026) enables this.
 */
export function buildEscrowCreateTx(params: CreateEscrowParams): EscrowCreate {
  // unixTimeToRippleTime expects milliseconds in xrpl.js v4+
  const cancelAfterRipple = unixTimeToRippleTime(params.cancelAfterDate.getTime());

  return {
    TransactionType: "EscrowCreate",
    Account: params.investorAddress,
    Destination: params.startupAddress,
    Amount: buildEscrowAmount(params.amountRLUSD),
    Condition: params.condition,
    CancelAfter: cancelAfterRipple,
  } as unknown as EscrowCreate;
}

/**
 * Builds an EscrowFinish transaction.
 * The platform submits this server-side after AI approval (includes fulfillment).
 */
export function buildEscrowFinishTx(params: FinishEscrowParams): EscrowFinish {
  return {
    TransactionType: "EscrowFinish",
    Account: params.investorAddress,
    Owner: params.investorAddress,
    OfferSequence: params.escrowSequence,
    Condition: params.condition,
    Fulfillment: params.fulfillment,
  };
}

/**
 * Builds an EscrowCancel transaction.
 * Can be submitted by anyone after the CancelAfter deadline.
 */
export function buildEscrowCancelTx(params: CancelEscrowParams): EscrowCancel {
  return {
    TransactionType: "EscrowCancel",
    Account: params.callerAddress,
    Owner: params.investorAddress,
    OfferSequence: params.escrowSequence,
  };
}

/**
 * Submits an already-signed transaction blob to XRPL and waits for validation.
 * Returns the transaction hash and escrow sequence (for EscrowCreate).
 */
export async function submitSignedTransaction(signedTxBlob: string): Promise<{
  hash: string;
  sequence?: number;
  result: string;
}> {
  const client = await getXRPLClient();
  const response = await client.submitAndWait(signedTxBlob);

  const meta = response.result.meta;
  const txResult =
    typeof meta === "object" && meta !== null && "TransactionResult" in meta
      ? (meta as { TransactionResult: string }).TransactionResult
      : "UNKNOWN";

  if (txResult !== "tesSUCCESS") {
    throw new Error(`Transaction failed: ${txResult}`);
  }

  const txJson = response.result.tx_json as { Sequence?: number };

  return {
    hash: response.result.hash,
    sequence: txJson.Sequence,
    result: txResult,
  };
}

/**
 * Looks up an escrow on-chain to verify it still exists and get its state.
 */
export async function getEscrowState(
  investorAddress: string,
  escrowSequence: number
): Promise<{ exists: boolean; amount?: string }> {
  const client = await getXRPLClient();
  try {
    const response = await client.request({
      command: "account_objects",
      account: investorAddress,
      type: "escrow",
    });

    const escrows = response.result.account_objects as Array<{
      LedgerEntryType: string;
      PreviousTxnLgrSeq?: number;
      Sequence?: number;
      Amount?: { value: string } | string;
    }>;

    const found = escrows.find((e) => e.Sequence === escrowSequence);

    if (!found) return { exists: false };

    const amount =
      typeof found.Amount === "object" && found.Amount !== null
        ? found.Amount.value
        : found.Amount;

    return { exists: true, amount };
  } catch {
    return { exists: false };
  }
}
