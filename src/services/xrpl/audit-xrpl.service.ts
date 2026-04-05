import * as xrpl from "xrpl";

const XRPL_WSS =
  process.env.XRPL_WSS_URL ?? "wss://s.altnet.rippletest.net:51233";

interface XrplAuditParams {
  event: string;
  contractId: string;
  milestoneId?: string | null;
  actor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit memo to the native XRP Ledger (testnet) as a 1-drop
 * Payment to self with hex-encoded JSON in the Memos field.
 * Never throws — returns null on failure.
 */
export async function writeXrplAuditMemo(
  params: XrplAuditParams
): Promise<string | null> {
  const seed = process.env.XRPL_PLATFORM_SEED;
  if (!seed) {
    console.warn("[xrpl-audit] XRPL_PLATFORM_SEED not set — skipping");
    return null;
  }

  const client = new xrpl.Client(XRPL_WSS);
  try {
    await client.connect();
    const wallet = xrpl.Wallet.fromSeed(seed);

    const payload = JSON.stringify({
      app: "cascrow",
      v: 1,
      event: params.event,
      contractId: params.contractId,
      milestoneId: params.milestoneId ?? null,
      actor: params.actor ?? "PLATFORM",
      metadata: params.metadata ?? {},
      ts: new Date().toISOString(),
    });

    const tx: xrpl.Payment = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: wallet.address,
      Amount: "1",
      Memos: [
        {
          Memo: {
            MemoData: Buffer.from(payload).toString("hex").toUpperCase(),
            MemoType: Buffer.from("cascrow/audit").toString("hex").toUpperCase(),
            MemoFormat: Buffer.from("application/json")
              .toString("hex")
              .toUpperCase(),
          },
        },
      ],
    };

    const prepared = await client.autofill(tx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    return result.result.hash;
  } catch (err) {
    console.error("[xrpl-audit] write failed:", err);
    return null;
  } finally {
    try {
      await client.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }
}
