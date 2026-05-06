import { NextResponse } from "next/server";

export async function GET() {
  const doc = {
    schema_version: "1.0",
    name: "Cascrow",
    description: "Agentic escrow and verification platform on the XRP Ledger.",
    base_url: "https://cascrow.com",
    blockchain: {
      escrow: {
        chain: "XRPL EVM Sidechain",
        chain_id: 1449000,
        rpc: "https://rpc.testnet.xrplevm.org",
        escrow_contract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS ?? null,
        settlement_token: {
          symbol: "RLUSD",
          contract: process.env.NEXT_PUBLIC_RLUSD_CONTRACT_ADDRESS ?? null,
          decimals: 18,
          issuer: "Ripple",
        },
      },
      certificates: {
        chain: "XRP Ledger Mainnet",
        type: "NFT (NFTokenMint)",
        purpose: "Non-transferable completion certificates and audit trail memos",
        explorer: "https://xrpscan.com",
      },
    },
    verification: {
      quorum: "3/5 majority vote",
      models: [
        "claude-haiku-4-5",
        "gemini-2.0-flash",
        "gpt-4o-mini",
        "mistral-small-latest",
        "qwen3-32b (Cerebras)",
      ],
      confidence_tiers: [
        { threshold: ">85% + 3/5 YES", outcome: "VERIFIED", action: "funds released on-chain automatically" },
        { threshold: "60–85%", outcome: "PENDING_REVIEW", action: "human or agent review required (see agentReviewMode)" },
        { threshold: "<60%", outcome: "REJECTED", action: "submitter notified, can resubmit" },
      ],
    },
    agent_support: {
      registration: "POST https://cascrow.com/api/agent/register",
      api_key_prefix: "csk_",
      mcp_package: "cascrow-mcp",
      mcp_install: "npx cascrow-mcp",
      openapi: "https://cascrow.com/api/openapi.json",
      llms_txt: "https://cascrow.com/llms.txt",
      kyc_tiers: [
        { tier: 0, requirement: "registration", max_contract_usd: 1000 },
        { tier: 1, requirement: "$2,000 cumulative paid out", max_contract_usd: 10000 },
        { tier: 2, requirement: "$20,000 cumulative paid out", max_contract_usd: null },
      ],
      review_modes: [
        { mode: "AUTO", description: "60-85% confidence → REJECTED immediately (default, fully autonomous)" },
        { mode: "MANUAL", description: "60-85% confidence → PENDING_REVIEW, funder agent reviews via API" },
        { mode: "MANUAL_AUTO", description: "60-85% confidence → PENDING_REVIEW, auto-approves after 48h" },
      ],
    },
    stats_url: "https://cascrow.com/api/stats/public",
    verify_certificate_url: "https://cascrow.com/api/verify-certificate?nftTokenId={nftTokenId}",
    contact: "hello@cascrow.com",
    terms: "https://cascrow.com/terms",
  };

  return NextResponse.json(doc, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
