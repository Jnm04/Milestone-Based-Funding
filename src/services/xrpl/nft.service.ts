import { Client, Wallet } from "xrpl";

const XRPL_WSS = process.env.XRPL_WSS_URL ?? "wss://s.altnet.rippletest.net:51233";
const XRPL_EXPLORER = "https://testnet.xrpl.org";

export interface MintResult {
  tokenId: string;
  txHash: string;
  explorerUrl: string;
}

/**
 * Mint a non-transferable completion certificate NFT on the XRPL ledger.
 * The platform wallet mints and holds the NFT; it serves as an immutable
 * on-chain record that the milestone was AI-verified and funds released.
 *
 * URI contains JSON metadata encoded as uppercase hex:
 *   { p, type, v, contract, milestone, amount, completed, evmTx? }
 *
 * Requires XRPL_PLATFORM_SEED in environment.
 * Fails gracefully — callers should catch and log, not crash.
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

  const client = new Client(XRPL_WSS);
  await client.connect();

  try {
    const wallet = Wallet.fromSeed(seed);

    const metadata: Record<string, string> = {
      p: "cascrow",
      type: "milestone-certificate",
      v: "1",
      contract: params.contractId,
      milestone: params.milestoneTitle,
      amount: `${params.amountUSD} RLUSD`,
      completed: params.completedAt.toISOString(),
    };
    if (params.evmTxHash) metadata.evmTx = params.evmTxHash;

    const uri = Buffer.from(JSON.stringify(metadata))
      .toString("hex")
      .toUpperCase();

    const prepared = await client.autofill({
      TransactionType: "NFTokenMint",
      Account: wallet.address,
      URI: uri,
      Flags: 0,        // non-transferable (tfTransferable not set)
      NFTokenTaxon: 1, // cascrow milestone certificates
    });

    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta;
    if (!meta || typeof meta !== "object" || !("nftoken_id" in meta)) {
      throw new Error("NFT minted but token ID missing in response");
    }

    const tokenId = (meta as Record<string, unknown>).nftoken_id as string;
    const txHash = result.result.hash;

    return {
      tokenId,
      txHash,
      explorerUrl: `${XRPL_EXPLORER}/nft/${tokenId}`,
    };
  } finally {
    await client.disconnect();
  }
}
