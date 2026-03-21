/**
 * Demo Seed Script
 * Run: npm run db:seed
 *
 * Pre-populates a demo investor + startup + contract for live demo purposes.
 * The contract starts in AWAITING_ESCROW so you can walk through the full
 * flow live: Fund Escrow → Upload Proof → AI Verify → Release Funds.
 *
 * Testnet wallets (pre-funded on XRPL Testnet):
 *   Investor: rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe
 *   Startup:  rN7n3473SaZBCG4dFL83w7PB5wGzBfpMCG
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const INVESTOR_WALLET = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const STARTUP_WALLET = "rN7n3473SaZBCG4dFL83w7PB5wGzBfpMCG";

async function main() {
  console.log("=== MilestoneFund Demo Seed ===\n");

  // Upsert investor
  const investor = await prisma.user.upsert({
    where: { walletAddress: INVESTOR_WALLET },
    update: {},
    create: {
      walletAddress: INVESTOR_WALLET,
      role: "INVESTOR",
    },
  });
  console.log(`✓ Investor:  ${investor.walletAddress} (id: ${investor.id})`);

  // Upsert startup
  const startup = await prisma.user.upsert({
    where: { walletAddress: STARTUP_WALLET },
    update: {},
    create: {
      walletAddress: STARTUP_WALLET,
      role: "STARTUP",
    },
  });
  console.log(`✓ Startup:   ${startup.walletAddress} (id: ${startup.id})`);

  // Create demo contract (cancel 14 days from now)
  const cancelAfter = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const inviteToken = nanoid(12);

  const existing = await prisma.contract.findFirst({
    where: {
      investorId: investor.id,
      startupId: startup.id,
      status: { in: ["AWAITING_ESCROW", "FUNDED", "DRAFT"] },
    },
  });

  if (existing) {
    console.log(`\n⚠  Demo contract already exists (id: ${existing.id}, status: ${existing.status})`);
    console.log(`   Invite link: /join/${existing.inviteLink}`);
    console.log("\nSkipping creation — delete the contract from DB to re-seed.");
  } else {
    const contract = await prisma.contract.create({
      data: {
        investorId: investor.id,
        startupId: startup.id,
        milestone:
          "Deliver a working MVP with user authentication, core product features, and at least 10 beta users providing written feedback.",
        amountUSD: 1500,
        amountRLUSD: "1500.00",
        status: "AWAITING_ESCROW",
        cancelAfter,
        inviteLink: inviteToken,
      },
    });

    console.log(`\n✓ Demo contract created!`);
    console.log(`  Contract ID:  ${contract.id}`);
    console.log(`  Status:       ${contract.status}`);
    console.log(`  Amount:       ${contract.amountRLUSD} RLUSD ($${contract.amountUSD})`);
    console.log(`  Deadline:     ${cancelAfter.toLocaleDateString()}`);
    console.log(`  Invite link:  /join/${contract.inviteLink}`);
    console.log(`\n  → Open: /contract/${contract.id}`);
  }

  console.log("\n=== Seed complete ===");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
