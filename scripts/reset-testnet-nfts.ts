import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

neonConfig.poolQueryViaFetch = true;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Known mainnet token IDs — keep these, reset everything else
const MAINNET_TOKENS = new Set([
  "000000002225C85A43DB4525A84E7BF86ECB86EF9761C2A161F99CB9062AE61D",
]);

async function main() {
  const contracts = await prisma.contract.findMany({
    where: { nftTokenId: { not: null } },
    select: { id: true, nftTokenId: true },
  });

  for (const c of contracts) {
    if (!c.nftTokenId || (MAINNET_TOKENS.has(c.nftTokenId) && c.nftTokenId !== "PENDING")) {
      console.log(`Keep contract ${c.id} (${c.nftTokenId?.slice(0, 16)}...)`);
      continue;
    }
    await prisma.contract.update({
      where: { id: c.id },
      data: { nftTokenId: null, nftTxHash: null, nftImageUrl: null },
    });
    console.log(`Reset contract ${c.id} (was: ${c.nftTokenId.slice(0, 16)}...)`);
  }

  const milestones = await prisma.milestone.findMany({
    where: { nftTokenId: { not: null } },
    select: { id: true, nftTokenId: true },
  });

  for (const m of milestones) {
    if (!m.nftTokenId || (MAINNET_TOKENS.has(m.nftTokenId) && m.nftTokenId !== "PENDING")) {
      console.log(`Keep milestone ${m.id}`);
      continue;
    }
    await prisma.milestone.update({
      where: { id: m.id },
      data: { nftTokenId: null, nftTxHash: null, nftImageUrl: null },
    });
    console.log(`Reset milestone ${m.id} (was: ${m.nftTokenId.slice(0, 16)}...)`);
  }

  console.log("\nDone — testnet NFT IDs cleared. They will re-mint on Mainnet.");
  await prisma.$disconnect();
}

main().catch(console.error);
