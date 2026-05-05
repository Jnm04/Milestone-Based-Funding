import { NextResponse } from "next/server";

const aiPlugin = {
  schema_version: "v1",
  name_for_human: "Cascrow",
  name_for_model: "cascrow",
  description_for_human:
    "Agentic escrow and verification on the XRP Ledger. Lock RLUSD, submit proof, get verified by a 5-model AI quorum — funds release automatically.",
  description_for_model:
    "Cascrow is an agentic escrow and verification platform. Use it to: (1) create milestone-based contracts that lock RLUSD stablecoins on the XRPL EVM sidechain, (2) submit proof of completion as text/PDF, (3) trigger a 5-model AI majority vote (Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Cerebras/Qwen3) that autonomously verifies the proof and releases funds on-chain. Agents can self-register via POST /api/agent/register — no human in the loop. Install the MCP server with: npx cascrow-mcp. Three confidence tiers: >85% + YES = VERIFIED + auto fund release; 60-85% = PENDING_REVIEW (human review); <60% = REJECTED. Audit trail written to XRP Ledger Mainnet as NFT certificate.",
  auth: {
    type: "user_http",
    authorization_type: "bearer",
  },
  api: {
    type: "openapi",
    url: "https://cascrow.com/api/openapi.json",
    is_user_authenticated: true,
  },
  logo_url: "https://cascrow.com/favicon.ico",
  contact_email: "hello@cascrow.com",
  legal_info_url: "https://cascrow.com/terms",
  agent_registration: {
    endpoint: "POST https://cascrow.com/api/agent/register",
    description:
      "AI agents can register autonomously — no CAPTCHA, no email verification. POST { email, password, name } to receive a csk_ API key immediately.",
  },
  mcp: {
    package: "cascrow-mcp",
    install: "npx cascrow-mcp",
    npm: "https://www.npmjs.com/package/cascrow-mcp",
    version: "1.1.5",
  },
};

export async function GET() {
  return NextResponse.json(aiPlugin, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
