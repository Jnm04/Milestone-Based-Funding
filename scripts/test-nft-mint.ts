/**
 * Test script: creates a COMPLETED contract in the DB and triggers NFT mint.
 * Run: npx tsx scripts/test-nft-mint.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== NFT Mint Test ===\n");

  const passwordHash = await bcrypt.hash("Test1234!", 10);

  const investor = await prisma.user.upsert({
    where: { email: "nft-test-investor@demo.local" },
    update: {},
    create: {
      email: "nft-test-investor@demo.local",
      passwordHash,
      walletAddress: "0xNFTTestInvestor",
      role: "INVESTOR",
      emailVerified: true,
    },
  });

  const startup = await prisma.user.upsert({
    where: { email: "nft-test-startup@demo.local" },
    update: {},
    create: {
      email: "nft-test-startup@demo.local",
      passwordHash,
      walletAddress: "0xNFTTestStartup",
      role: "STARTUP",
      emailVerified: true,
    },
  });

  const contract = await prisma.contract.create({
    data: {
      investorId: investor.id,
      startupId: startup.id,
      milestone: "Deliver MVP landing page with wallet connect flow",
      amountUSD: 2500,
      status: "COMPLETED",
      cancelAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      evmTxHash: "0xdeadbeef1234567890abcdef",
    },
  });

  console.log(`✓ Contract created: ${contract.id}`);
  console.log(`  Status: ${contract.status}`);
  console.log(`  Amount: $${contract.amountUSD}`);
  console.log(`\nNow trigger the mint:`);
  console.log(`  npx tsx scripts/trigger-nft-mint.ts ${contract.id}`);
  console.log(`\nOr visit the contract page (you'll need to be logged in as the investor/startup):`);
  console.log(`  https://cascrow.xyz/contract/${contract.id}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
