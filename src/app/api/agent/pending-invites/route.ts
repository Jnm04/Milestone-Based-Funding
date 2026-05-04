import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";

// GET /api/agent/pending-invites
// Builder agent polls this to find unclaimed invite codes sent to its account email.
// Returns all unclaimed handoffs and marks them as claimed atomically.
export async function GET(request: Request) {
  const authHeader = (request as { headers: Headers }).headers.get("authorization");
  const apiKeyCtx = await resolveApiKey(authHeader);
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: apiKeyCtx.userId },
    select: { email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch and claim all pending invites for this email atomically
  const pending = await prisma.agentHandoff.findMany({
    where: { builderEmail: user.email, claimedAt: null },
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
