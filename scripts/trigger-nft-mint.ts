/**
 * Directly calls mintCompletionNFT for a contract ID — no HTTP, no auth needed.
 * Run: npx tsx scripts/trigger-nft-mint.ts <contractId>
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Must be set before nft.service.ts is imported (top-level constants read env at import time)
process.env.XRPL_HTTP_URL = process.env.XRPL_NETWORK === "mainnet"
  ? "https://xrplcluster.com"
  : "https://s.altnet.rippletest.net:51234";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mintCompletionNFT } from "../src/services/xrpl/nft.service";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const contractId = process.argv[2];
  if (!contractId) {
    console.error("Usage: npx tsx scripts/trigger-nft-mint.ts <contractId>");
    process.exit(1);
  }

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) {
    console.error("Contract not found:", contractId);
    process.exit(1);
  }

  if (contract.nftTokenId) {
    console.log("Already minted:", contract.nftTokenId);
    process.exit(0);
  }

  console.log(`Minting NFT for contract: ${contractId}`);
  console.log(`Milestone: ${contract.milestone}`);
  console.log(`Amount: $${contract.amountUSD}`);
  console.log("...\n");

  const nft = await mintCompletionNFT({
    contractId: contract.id,
    milestoneTitle: contract.milestone,
    amountUSD: contract.amountUSD.toString(),
    completedAt: new Date(),
    evmTxHash: contract.evmTxHash ?? null,
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      nftTokenId: nft.tokenId,
      nftTxHash: nft.txHash,
      nftImageUrl: nft.imageUrl ?? null,
    },
  });

  console.log("✓ NFT minted!");
  console.log("  Token ID:  ", nft.tokenId);
  console.log("  Tx Hash:   ", nft.txHash);
  console.log("  Explorer:  ", nft.explorerUrl);
  console.log("  Image URL: ", nft.imageUrl ?? "(upload failed, fallback URI used)");
  console.log(`\n  View on cascrow: https://cascrow.xyz/contract/${contractId}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
