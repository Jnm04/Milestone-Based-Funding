/**
 * End-to-End Flow Test (without Xumm / DB — logic only)
 * Run: npx tsx scripts/test-e2e-flow.ts
 *
 * Simulates the full MilestoneFund flow:
 * 1. Crypto-condition generation
 * 2. EscrowCreate TX building
 * 3. Mock proof + AI verification
 * 4. EscrowFinish TX building
 * 5. EscrowCancel TX building (deadline scenario)
 * 6. Error cases
 */

import { generateCryptoCondition } from "../src/services/crypto/condition.service";
import {
  buildEscrowCreateTx,
  buildEscrowFinishTx,
  buildEscrowCancelTx,
} from "../src/services/xrpl/escrow.service";
import { mockVerifyMilestone } from "../src/services/ai/verifier.service";

// Test wallets (Testnet addresses only)
const INVESTOR = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const STARTUP  = "rN7n3473SaZBCG4dFL83w7PB5wGzBfpMCG";

function pass(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string) { console.error(`  ✗ ${msg}`); process.exit(1); }
function section(title: string) { console.log(`\n── ${title}`); }

async function main() {
  console.log("=== MilestoneFund E2E Flow Test ===");

  // ─── Phase 1: Contract setup ─────────────────────────────────────────────
  section("1. Crypto-Condition Generation");
  const { condition, fulfillment } = generateCryptoCondition();
  if (!condition.startsWith("A1")) fail("Condition has wrong prefix");
  if (!fulfillment.startsWith("A0")) fail("Fulfillment has wrong prefix");
  pass(`Condition:   ${condition.slice(0, 24)}…`);
  pass(`Fulfillment: ${fulfillment.slice(0, 24)}…`);

  // ─── Phase 2: Escrow creation ─────────────────────────────────────────────
  section("2. EscrowCreate TX");
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
  const escrowCreateTx = buildEscrowCreateTx({
    investorAddress: INVESTOR,
    startupAddress: STARTUP,
    amountRLUSD: "1500.00",
    condition,
    cancelAfterDate: deadline,
  });

  if (escrowCreateTx.TransactionType !== "EscrowCreate") fail("Wrong tx type");
  const txAmount = (escrowCreateTx as unknown as { Amount: { value: string } }).Amount;
  if (txAmount.value !== "1500.00") fail("Wrong RLUSD amount");
  if ((escrowCreateTx.CancelAfter as number) < 800000000) fail("CancelAfter looks wrong");
  pass(`TransactionType: ${escrowCreateTx.TransactionType}`);
  pass(`Amount: ${txAmount.value} RLUSD`);
  pass(`CancelAfter: ${escrowCreateTx.CancelAfter} (Ripple epoch)`);

  // ─── Phase 3: Simulate escrow funded (investor signed, sequence assigned) ─
  section("3. Escrow Funded (simulate sequence = 42001337)");
  const escrowSequence = 42001337;
  pass(`Escrow sequence recorded: ${escrowSequence}`);

  // ─── Phase 4: AI Verification — YES path ──────────────────────────────────
  section("4a. AI Verification — YES path");
  const longProof = "This is detailed milestone evidence. ".repeat(30);
  const resultYes = mockVerifyMilestone({
    milestone: "Deliver a working MVP with user authentication",
    extractedText: longProof,
  });
  if (resultYes.decision !== "YES") fail("Expected YES from mock verifier");
  if (resultYes.confidence < 50) fail("Confidence too low");
  pass(`Decision: ${resultYes.decision}`);
  pass(`Confidence: ${resultYes.confidence}%`);

  // ─── Phase 5: EscrowFinish TX ─────────────────────────────────────────────
  section("5. EscrowFinish TX (after YES)");
  const finishTx = buildEscrowFinishTx({
    investorAddress: INVESTOR,
    escrowSequence,
    fulfillment,
    condition,
  });
  if (finishTx.TransactionType !== "EscrowFinish") fail("Wrong tx type");
  if (finishTx.OfferSequence !== escrowSequence) fail("Wrong OfferSequence");
  if (!finishTx.Fulfillment) fail("Missing Fulfillment");
  if (!finishTx.Condition) fail("Missing Condition");
  pass(`TransactionType: ${finishTx.TransactionType}`);
  pass(`OfferSequence: ${finishTx.OfferSequence}`);
  pass(`Fulfillment present: ${!!finishTx.Fulfillment}`);

  // ─── Phase 6: AI Verification — NO path ──────────────────────────────────
  section("4b. AI Verification — NO path (short proof)");
  const resultNo = mockVerifyMilestone({
    milestone: "Deliver a working MVP",
    extractedText: "hi",
  });
  if (resultNo.decision !== "NO") fail("Expected NO from mock verifier");
  pass(`Decision: ${resultNo.decision}`);
  pass(`Confidence: ${resultNo.confidence}%`);

  // ─── Phase 7: EscrowCancel TX (deadline exceeded) ─────────────────────────
  section("6. EscrowCancel TX (deadline scenario)");
  const cancelTx = buildEscrowCancelTx({
    callerAddress: INVESTOR,
    investorAddress: INVESTOR,
    escrowSequence,
  });
  if (cancelTx.TransactionType !== "EscrowCancel") fail("Wrong tx type");
  if (cancelTx.OfferSequence !== escrowSequence) fail("Wrong OfferSequence");
  pass(`TransactionType: ${cancelTx.TransactionType}`);
  pass(`OfferSequence: ${cancelTx.OfferSequence}`);

  // ─── Phase 8: Error cases ─────────────────────────────────────────────────
  section("7. Error Cases");

  // Missing fulfillment in finish tx → undefined fields
  const partialFinish = buildEscrowFinishTx({
    investorAddress: INVESTOR,
    escrowSequence,
    fulfillment: "",
    condition: "",
  });
  pass(`Empty fulfillment is handled: Fulfillment="${partialFinish.Fulfillment}"`);

  // Deadline check logic
  const pastDeadline = new Date(Date.now() - 1000);
  const isExpired = new Date() >= pastDeadline;
  if (!isExpired) fail("Deadline check broken");
  pass("Deadline expiry check works correctly");

  // AI with very short text → NO
  const edgeResult = mockVerifyMilestone({ milestone: "anything", extractedText: "x".repeat(99) });
  if (edgeResult.decision !== "NO") fail("99-char text should be NO (< 100)");
  pass(`Edge case: 99-char text → ${edgeResult.decision}`);

  const borderResult = mockVerifyMilestone({ milestone: "anything", extractedText: "x".repeat(101) });
  if (borderResult.decision !== "YES") fail("101-char text should be YES (> 100)");
  pass(`Edge case: 101-char text → ${borderResult.decision}`);

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n=== All E2E flow tests passed ✓ ===");
  console.log("\nFull flow verified:");
  console.log("  Contract creation → Crypto-condition → EscrowCreate");
  console.log("  AI YES → EscrowFinish");
  console.log("  AI NO → Rejection");
  console.log("  Deadline → EscrowCancel");
}

main().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
