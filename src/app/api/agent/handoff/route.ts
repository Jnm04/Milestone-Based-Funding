import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  inviteCode: z.string().min(1).max(100),
  builderEmail: z.string().email().max(254),
  contractId: z.string().min(1).max(100),
  message: z.string().max(500).optional(),
});

// POST /api/agent/handoff
// Requester agent sends an invite code to a Builder agent's email.
// Builder agent picks it up via GET /api/agent/pending-invites.
export async function POST(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-handoff:${apiKeyCtx.userId}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { inviteCode, builderEmail, contractId, message } = parsed.data;

  // Verify the contract belongs to the requester
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, inviteLink: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.investorId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const handoff = await prisma.agentHandoff.create({
    data: { inviteCode, builderEmail, contractId, message: message ?? null },
  });

  return NextResponse.json({
    handoffId: handoff.id,
    message: `Invite sent to ${builderEmail}. Builder agent can now pick it up.`,
  }, { status: 201 });
}
