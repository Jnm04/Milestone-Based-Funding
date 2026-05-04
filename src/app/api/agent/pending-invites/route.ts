import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";

// GET /api/agent/pending-invites
// Builder agent polls this to find unclaimed invites addressed to its Agent ID.
// Returns all unclaimed handoffs and marks them as claimed atomically.
export async function GET(request: Request) {
  const authHeader = (request as { headers: Headers }).headers.get("authorization");
  const apiKeyCtx = await resolveApiKey(authHeader);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const pending = await prisma.agentHandoff.findMany({
    where: { builderAgentId: apiKeyCtx.userId, claimedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length > 0) {
    await prisma.agentHandoff.updateMany({
      where: { id: { in: pending.map((h) => h.id) } },
      data: { claimedAt: new Date() },
    });
  }

  return NextResponse.json({
    invites: pending.map((h) => ({
      handoffId: h.id,
      inviteCode: h.inviteCode,
      contractId: h.contractId,
      message: h.message,
      sentAt: h.createdAt,
    })),
  });
}
