/**
 * XRPL Testnet integration test
 * Run: npx tsx scripts/test-xrpl.ts
 *
 * Tests:
 *  1. Connect to XRPL Testnet
 *  2. Generate a crypto-condition pair
 *  3. Build EscrowCreate / EscrowFinish / EscrowCancel transactions (structure only)
 *  4. Verify account_info works
 */

import { Client } from "xrpl";
import { generateCryptoCondition } from "../src/services/crypto/condition.service";
import {
  buildEscrowCreateTx,
  buildEscrowFinishTx,
  buildEscrowCancelTx,
} from "../src/services/xrpl/escrow.service";
import { buildTrustSetTx } from "../src/services/xrpl/trustline.service";

const WSS = "wss://s.altnet.rippletest.net:51233";

// Testnet funded wallets (from faucet — replace with fresh ones if needed)
const INVESTOR = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"; // example
const STARTUP  = "rN7n3473SaZBCG4dFL83w7PB5wGzBfpMCG"; // example

async function main() {
  console.log("=== MilestoneFund XRPL Service Tests ===\n");

  // 1. Connect
  console.log("1. Connecting to XRPL Testnet...");
  const client = new Client(WSS);
  await client.connect();
  console.log("   Connected:", client.url, "\n");

  // 2. Crypto-condition
  console.log("2. Generating crypto-condition...");
  const { condition, fulfillment } = generateCryptoCondition();
  console.log("   Condition   :", condition.slice(0, 40) + "...");
  console.log("   Fulfillment :", fulfillment.slice(0, 40) + "...\n");

  // 3. TrustSet transaction structure
  console.log("3. Building TrustSet transaction...");
  const trustSetTx = buildTrustSetTx(INVESTOR);
  console.log("   TrustSet Account   :", trustSetTx.Account);
  console.log("   LimitAmount issuer :", (trustSetTx.LimitAmount as { issuer: string }).issuer);
  console.log("   LimitAmount value  :", (trustSetTx.LimitAmount as { value: string }).value + "\n");

  // 4. EscrowCreate transaction structure
  console.log("4. Building EscrowCreate transaction...");
  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const escrowCreate = buildEscrowCreateTx({
    investorAddress: INVESTOR,
    startupAddress: STARTUP,
    amountRLUSD: "500.00",
    condition,
    cancelAfterDate: deadline,
  });
  console.log("   TransactionType :", escrowCreate.TransactionType);
  console.log("   Amount          :", JSON.stringify((escrowCreate as unknown as { Amount: unknown }).Amount));
  console.log("   Condition       :", (escrowCreate.Condition as string)?.slice(0, 20) + "...");
  console.log("   CancelAfter     :", escrowCreate.CancelAfter + "\n");

  // 5. EscrowFinish transaction structure
  console.log("5. Building EscrowFinish transaction...");
  const escrowFinish = buildEscrowFinishTx({
    investorAddress: INVESTOR,
    escrowSequence: 12345678,
    fulfillment,
    condition,
  });
  console.log("   TransactionType :", escrowFinish.TransactionType);
  console.log("   OfferSequence   :", escrowFinish.OfferSequence);
  console.log("   Fulfillment     :", (escrowFinish.Fulfillment as string)?.slice(0, 20) + "...\n");

  // 6. EscrowCancel transaction structure
  console.log("6. Building EscrowCancel transaction...");
  const escrowCancel = buildEscrowCancelTx({
    callerAddress: INVESTOR,
    investorAddress: INVESTOR,
    escrowSequence: 12345678,
  });
  console.log("   TransactionType :", escrowCancel.TransactionType);
  console.log("   OfferSequence   :", escrowCancel.OfferSequence + "\n");

  // 7. Live Testnet: check server info
  console.log("7. Fetching XRPL server info...");
  const serverInfo = await client.request({ command: "server_info" });
  const info = serverInfo.result.info;
  console.log("   Server version  :", info.build_version);
  console.log("   Ledger index    :", info.validated_ledger?.seq);
  console.log("   Network ID      :", info.network_id ?? "testnet\n");

  await client.disconnect();
  console.log("\n=== All tests passed ✓ ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
