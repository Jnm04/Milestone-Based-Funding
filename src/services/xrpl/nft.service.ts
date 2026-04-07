import * as xrpl from "xrpl";

const XRPL_HTTP =
  process.env.XRPL_HTTP_URL ?? "https://s.altnet.rippletest.net:51234";
const XRPL_EXPLORER = "https://testnet.xrpl.org";

export interface MintResult {
  tokenId: string;
  txHash: string;
  explorerUrl: string;
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
 * Mint a non-transferable completion certificate NFT on the XRPL Ledger.
 * Uses HTTP JSON-RPC (not WebSocket) so it works within Vercel serverless timeouts.
 *
 * URI contains JSON metadata encoded as uppercase hex:
 *   { p, type, v, contract, milestone, amount, completed, evmTx? }
 *
 * After submit we poll account_nfts to find the new token ID.
 * Requires XRPL_PLATFORM_SEED in environment.
 */
export async function mintCompletionNFT(params: {
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  completedAt: Date;
  evmTxHash?: string | null;
}): Promise<MintResult> {
  const seed = process.env.XRPL_PLATFORM_SEED;
  if (!seed) throw new Error("XRPL_PLATFORM_SEED not configured");

  const wallet = xrpl.Wallet.fromSeed(seed);

  // Fetch account info + fee in parallel
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

  // URI must be ≤ 256 bytes. Use short keys and truncate tx hash to stay within limit.
  const metadata: Record<string, string> = {
    p: "cascrow",
    c: params.contractId,
    m: params.milestoneTitle.slice(0, 60),
    a: params.amountUSD,
    t: params.completedAt.toISOString().slice(0, 10),
  };
  if (params.evmTxHash) metadata.tx = params.evmTxHash.slice(0, 20);

  const uri = Buffer.from(JSON.stringify(metadata))
    .toString("hex")
    .toUpperCase();

  const tx = {
    TransactionType: "NFTokenMint" as const,
    Account: wallet.address,
    URI: uri,
    Flags: 0,         // non-transferable (tfTransferable not set)
    NFTokenTaxon: 1,  // cascrow milestone certificates
    Fee: fee,
    Sequence: sequence,
  };

  const signed = wallet.sign(tx);
  const txHash = signed.hash;

  // Submit transaction
  const submitRes = await fetch(XRPL_HTTP, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "submit", params: [{ tx_blob: signed.tx_blob }] }),
  });
  const submitData = await submitRes.json() as { result?: { engine_result?: string } };

  if (
    submitData.result?.engine_result &&
    submitData.result.engine_result !== "tesSUCCESS" &&
    submitData.result.engine_result !== "terQUEUED"
  ) {
    throw new Error(`NFTokenMint rejected: ${submitData.result.engine_result}`);
  }

  // Wait for ledger to close (~3-4s), then fetch the new NFT
  await new Promise((r) => setTimeout(r, 5000));

  // Find the newly minted token by scanning account_nfts
  const nftsRes = await rpc("account_nfts", {
    account: wallet.address,
    ledger_index: "validated",
  });

  const nfts = (
    nftsRes.result as { account_nfts?: Array<{ NFTokenID: string; URI?: string }> }
  ).account_nfts ?? [];

  // Find by matching URI
  const match = nfts.find((n) => n.URI === uri);
  if (!match) {
    // Fallback: return most recently added (last in list)
    const last = nfts[nfts.length - 1];
    if (!last) throw new Error("NFT minted but could not find token ID");
    return {
      tokenId: last.NFTokenID,
      txHash,
      explorerUrl: `${XRPL_EXPLORER}/nft/${last.NFTokenID}`,
    };
  }

  return {
    tokenId: match.NFTokenID,
    txHash,
    explorerUrl: `${XRPL_EXPLORER}/nft/${match.NFTokenID}`,
  };
}
