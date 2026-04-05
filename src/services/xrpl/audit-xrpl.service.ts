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

    // Await the submit HTTP call so Vercel doesn't kill it before it completes.
    // We don't need ledger confirmation — the hash is deterministic from the signed blob.
    try {
      const submitRes = await fetch(XRPL_HTTP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "submit",
          params: [{ tx_blob: signed.tx_blob }],
        }),
      });
      const data = await submitRes.json();
      const engineResult = (data as { result?: { engine_result?: string } })
        ?.result?.engine_result;
      if (engineResult && engineResult !== "tesSUCCESS") {
        console.error("[xrpl-audit] submit rejected:", engineResult, data);
        return null;
      }
    } catch (err) {
      console.error("[xrpl-audit] submit fetch failed:", err);
      return null;
    }

    return signed.hash;
  } catch (err) {
    console.error("[xrpl-audit] write failed:", err);
    return null;
  }
}
