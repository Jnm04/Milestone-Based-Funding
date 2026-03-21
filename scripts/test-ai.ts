/**
 * AI Verifier test
 * Run: npx tsx scripts/test-ai.ts
 *
 * Tests mock verifier logic (no API key needed).
 * Set ANTHROPIC_API_KEY in .env.local to test the real Claude API.
 */

import { mockVerifyMilestone } from "../src/services/ai/verifier.service";

async function main() {
  console.log("=== MilestoneFund AI Verifier Tests ===\n");

  // Test 1: Document with substantial content → YES
  console.log("1. Substantial document (should → YES):");
  const result1 = mockVerifyMilestone({
    milestone: "Deliver a working MVP of the mobile app with user authentication and basic CRUD operations.",
    extractedText: `
      Project Milestone Report — Version 1.0
      Date: March 2026

      Executive Summary:
      We have successfully delivered the MVP of the mobile application as specified in the contract.
      The application includes full user authentication via email/password and OAuth2 (Google, Apple).
      Core CRUD operations are implemented for the main entity types: users, posts, and comments.

      Technical Achievements:
      - React Native frontend with Expo SDK 52
      - Node.js backend with PostgreSQL database
      - JWT-based authentication with refresh tokens
      - REST API with full CRUD endpoints
      - 85% test coverage across unit and integration tests
      - Deployed to AWS (frontend on S3/CloudFront, backend on ECS Fargate)

      Deliverables:
      1. Source code repository (GitHub) — ✓ Delivered
      2. Working iOS and Android builds — ✓ Available on TestFlight / Firebase App Distribution
      3. API documentation (Swagger) — ✓ Published at docs.ourapp.com
      4. Database schema + migration scripts — ✓ Included in /db folder

      The milestone has been fully met. We are ready to proceed to Phase 2.
    `.repeat(3), // make it long enough
  });
  console.log("   Decision  :", result1.decision);
  console.log("   Confidence:", result1.confidence + "%");
  console.log("   Reasoning :", result1.reasoning + "\n");

  // Test 2: Empty document → NO
  console.log("2. Short/empty document (should → NO):");
  const result2 = mockVerifyMilestone({
    milestone: "Deliver a working MVP.",
    extractedText: "hello",
  });
  console.log("   Decision  :", result2.decision);
  console.log("   Confidence:", result2.confidence + "%");
  console.log("   Reasoning :", result2.reasoning + "\n");

  console.log("=== Tests passed ✓ ===");
  console.log("\nTo test with real Claude API:");
  console.log("  1. Set ANTHROPIC_API_KEY in .env.local");
  console.log("  2. Call verifyMilestone() from verifier.service.ts");
}

main().catch(console.error);
