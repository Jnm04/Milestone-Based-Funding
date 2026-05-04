import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/api-key-auth";

// GET /api/agent/me
// Returns the Agent ID (userId) for the authenticated API key.
// Agents share this ID with Requester agents so work can be handed off.
export async function GET(request: Request) {
  const authHeader = (request as { headers: Headers }).headers.get("authorization");
  const apiKeyCtx = await resolveApiKey(authHeader);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  return NextResponse.json({ agentId: apiKeyCtx.userId });
}
