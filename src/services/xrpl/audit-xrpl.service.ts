import * as xrpl from "xrpl";

// HTTP JSON-RPC endpoint — avoids WebSocket overhead in serverless functions
const XRPL_HTTP =
  process.env.XRPL_HTTP_URL ?? "https://s.altnet.rippletest.net:51234";

interface XrplAuditParams {
  event: string;
  contractId: string;
  milestoneId?: string | null;
  actor?: string;
  metadata?: Record<string, unknown>;
}

async function rpc(method: string, params: Record<string, unknown>) {
  const res = await fetch(XRPL_HTTP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params: [params] }),
  });
  return res.json() as Promise<{ result: Record<string, unknown> }>;
}

/**
 * Writes an audit memo to the native XRP Ledger testnet as a 1-drop Payment
 * to self with hex-encoded JSON in the Memos field.
 *
 * Uses HTTP JSON-RPC (not WebSocket) so it works reliably in Vercel serverless.
 * Signs locally, submits without waiting for confirmation — returns the tx hash
 * immediately (deterministic from the signed blob).
 *
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

  try {
    const wallet = xrpl.Wallet.fromSeed(seed);

    // Fetch sequence number and current fee in parallel
    const [accountInfo, feeInfo] = await Promise.all([
      rpc("account_info", { account: wallet.address, ledger_index: "current" }),
      rpc("fee", {}),
    ]);

    const sequence = (
      accountInfo.result as { account_data: { Sequence: number } }
    ).account_data.Sequence;

    const fee =
      (feeInfo.result as { drops: { open_ledger_fee?: string } }).drops
        .open_ledger_fee ?? "12";

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

    const tx = {
      TransactionType: "Payment" as const,
      Account: wallet.address,
      Destination: wallet.address,
      Amount: "1",
      Fee: fee,
      Sequence: sequence,
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

    const signed = wallet.sign(tx);

    // Await the submit so Vercel doesn't kill it before completion.
    // Retry once with a fresh sequence if we hit a sequence conflict
    // (happens when two audit events fire within the same ledger interval ~3s).
    const submit = async (blob: string) => {
      const res = await fetch(XRPL_HTTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "submit", params: [{ tx_blob: blob }] }),
      });
      return res.json() as Promise<{ result?: { engine_result?: string; account_sequence_next?: number } }>;
    };

    let result = await submit(signed.tx_blob).catch((err) => {
      console.error("[xrpl-audit] submit fetch failed:", err);
      return null;
    });
    if (!result) return null;

    const SEQ_ERRORS = new Set(["tefPAST_SEQ", "terPRE_SEQ", "tefMAX_LEDGER"]);
    if (result.result?.engine_result && SEQ_ERRORS.has(result.result.engine_result)) {
      // Fetch fresh sequence and retry once
      console.warn("[xrpl-audit] sequence conflict, retrying with fresh sequence");
      const freshInfo = await rpc("account_info", { account: wallet.address, ledger_index: "current" });
      const freshSeq = (freshInfo.result as { account_data: { Sequence: number } }).account_data.Sequence;
      const retryTx = { ...tx, Sequence: freshSeq };
      const retrySigned = wallet.sign(retryTx);
      result = await submit(retrySigned.tx_blob).catch((err) => {
        console.error("[xrpl-audit] retry submit failed:", err);
        return null;
      });
      if (!result) return null;
      if (result.result?.engine_result && result.result.engine_result !== "tesSUCCESS") {
        console.error("[xrpl-audit] retry rejected:", result.result.engine_result);
        return null;
      }
      return retrySigned.hash;
    }

    if (result.result?.engine_result && result.result.engine_result !== "tesSUCCESS") {
      console.error("[xrpl-audit] submit rejected:", result.result.engine_result);
      return null;
    }

    return signed.hash;
  } catch (err) {
    console.error("[xrpl-audit] write failed:", err);
    return null;
  }
}
