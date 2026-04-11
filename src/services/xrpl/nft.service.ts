import * as xrpl from "xrpl";
import { uploadCertificateAssets } from "./cert-image.service";

function getXrplConfig() {
  // Default to mainnet — only use testnet if explicitly set
  const isTestnet = process.env.XRPL_NETWORK === "testnet" || process.env.NEXT_PUBLIC_XRPL_NETWORK === "testnet";
  const http = process.env.XRPL_HTTP_URL ?? (isTestnet
    ? "https://s.altnet.rippletest.net:51234"
    : "https://s1.ripple.com:51234");
  const explorer = isTestnet ? "https://testnet.xrpl.org" : "https://livenet.xrpl.org";
  return { http, explorer };
}

export interface MintResult {
  tokenId: string;
  txHash: string;
  explorerUrl: string;
  imageUrl?: string;
}

async function rpc(url: string, method: string, params: Record<string, unknown>) {
  const res = await fetch(url, {
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
  const { http: XRPL_HTTP, explorer: XRPL_EXPLORER } = getXrplConfig();

  const seed = process.env.XRPL_PLATFORM_SEED;
  if (!seed) throw new Error("XRPL_PLATFORM_SEED not configured");

  const wallet = xrpl.Wallet.fromSeed(seed);

  // Build URI first so we can check for an existing NFT before minting
  const certAssets = uploadCertificateAssets({
    contractId: params.contractId,
    milestoneTitle: params.milestoneTitle,
    amountUSD: params.amountUSD,
    completedAt: params.completedAt,
    evmTxHash: params.evmTxHash,
  });
  const uriString = certAssets.metadataUrl;
  const uriHex = Buffer.from(uriString).toString("hex").toUpperCase();
  if (uriHex.length > 512) throw new Error(`NFT URI too long: ${uriHex.length} hex chars (max 512)`);
  const uri = uriHex;

  // Check if NFT was already minted (idempotency — handles double-click / retry)
  const existingNfts = await rpc(XRPL_HTTP, "account_nfts", {
    account: wallet.address,
    ledger_index: "validated",
  });
  const existingList = (existingNfts.result as { account_nfts?: Array<{ NFTokenID: string; URI?: string }> }).account_nfts ?? [];
  const alreadyMinted = existingList.find((n) => n.URI === uri);
  if (alreadyMinted) {
    return {
      tokenId: alreadyMinted.NFTokenID,
      txHash: alreadyMinted.NFTokenID, // no tx hash available after the fact
      explorerUrl: `${XRPL_EXPLORER}/nfts/${alreadyMinted.NFTokenID}`,
      imageUrl: certAssets.imageUrl,
    };
  }

  // Fetch account info + fee in parallel
  const [accountInfo, feeInfo] = await Promise.all([
    rpc(XRPL_HTTP, "account_info", { account: wallet.address, ledger_index: "current" }),
    rpc(XRPL_HTTP, "fee", {}),
  ]);

  const accountData = (accountInfo.result as { account_data?: { Sequence: number }; error?: string; error_message?: string }).account_data;
  if (!accountData) {
    const errCode = (accountInfo.result as { error?: string }).error ?? "unknown";
    throw new Error(`XRPL account_info failed: ${errCode} — wallet may not be funded on mainnet (${wallet.address})`);
  }
  const sequence = accountData.Sequence;

  const fee =
    (feeInfo.result as { drops: { open_ledger_fee?: string } }).drops
      .open_ledger_fee ?? "12";

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

  const engineResult = submitData.result?.engine_result;
  if (engineResult && engineResult !== "tesSUCCESS" && engineResult !== "terQUEUED") {
    // tefPAST_SEQ means a previous attempt already consumed this sequence — check if NFT exists
    if (engineResult === "tefPAST_SEQ") {
      await new Promise((r) => setTimeout(r, 4000));
      const retryNfts = await rpc(XRPL_HTTP, "account_nfts", { account: wallet.address, ledger_index: "validated" });
      const retryList = (retryNfts.result as { account_nfts?: Array<{ NFTokenID: string; URI?: string }> }).account_nfts ?? [];
      const found = retryList.find((n) => n.URI === uri);
      if (found) {
        return { tokenId: found.NFTokenID, txHash, explorerUrl: `${XRPL_EXPLORER}/nfts/${found.NFTokenID}`, imageUrl: certAssets.imageUrl };
      }
    }
    throw new Error(`NFTokenMint rejected: ${engineResult}`);
  }

  // Poll account_nfts until the new NFT appears (up to 30s, checking every 4s)
  const imageUrl = certAssets.imageUrl;
  for (let attempt = 0; attempt < 7; attempt++) {
    await new Promise((r) => setTimeout(r, 4000));
    const nftsRes = await rpc(XRPL_HTTP, "account_nfts", {
      account: wallet.address,
      ledger_index: "validated",
    });
    const nfts = (
      nftsRes.result as { account_nfts?: Array<{ NFTokenID: string; URI?: string }> }
    ).account_nfts ?? [];
    const match = nfts.find((n) => n.URI === uri);
    if (match) {
      return {
        tokenId: match.NFTokenID,
        txHash,
        explorerUrl: `${XRPL_EXPLORER}/nfts/${match.NFTokenID}`,
        imageUrl,
      };
    }
  }
  throw new Error("NFT minted but not found in validated ledger after 28s — check XRPL explorer for tx: " + txHash);
}
