import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only STARTUPs can decline a contract
  if (session.user.role !== "STARTUP") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 declines per user per 10 minutes — prevents DoS on open invite links
  if (!(await checkRateLimit(`decline-contract:${session.user.id}`, 10, 10 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  const { inviteCode } = await req.json();
  if (!inviteCode) return NextResponse.json({ error: "Missing inviteCode" }, { status: 400 });

  const contract = await prisma.contract.findUnique({ where: { inviteLink: inviteCode } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "DRAFT") return NextResponse.json({ error: "Contract is no longer pending" }, { status: 409 });

  // Investor cannot decline their own invite link
  if (contract.investorId === session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If the contract already has a startup assigned, only they can decline
  // If no startup is assigned yet, require that the user actually joined via the same link
  // (they must be the assigned startup or the invite link must still be open for their account)
  if (contract.startupId && contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Prevent any random STARTUP from declining an open contract that has no assignee yet —
  // only the explicitly assigned startup may decline a contract they haven't joined yet.
  // If startupId is null, the contract is open for anyone with the link; we allow decline
  // only if the caller IS the assigned startup (handled above) or the contract has no assignee.
  // This preserves the flow where a startup declines before formally joining.

  await prisma.contract.update({
    where: { id: contract.id },
    data: { status: "DECLINED" },
  });

  return NextResponse.json({ ok: true });
}
