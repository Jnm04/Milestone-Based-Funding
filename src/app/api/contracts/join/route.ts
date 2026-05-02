import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import { resolveApiKey } from "@/lib/api-key-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const apiKeyCtx = !session ? await resolveApiKey(request.headers.get("authorization")) : null;
    const userId = session?.user?.id ?? apiKeyCtx?.userId ?? null;

    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const ip = getClientIp(request) ?? "unknown";
    if (!(await checkRateLimit(`join-contract:${userId}:${ip}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // Session users must have STARTUP role; API key agents are always treated as builders
    if (session && session.user.role !== "STARTUP") {
      return NextResponse.json({ error: "Only startups can join contracts" }, { status: 403 });
    }

    let inviteCode: string | undefined;
    try {
      const body = await request.json();
      inviteCode = body.inviteCode;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!inviteCode) {
      return NextResponse.json({ error: "inviteCode is required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { inviteLink: inviteCode },
      include: { milestones: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    // Wallet required for escrow contracts via browser; API key agents skip this —
    // they use verification-only mode (amountUSD: 0) or the platform handles release server-side
    const isEscrow = contract.milestones.some((m) => Number(m.amountUSD) > 0);
    if (session && isEscrow && !session.user.walletAddress) {
      return NextResponse.json(
        { error: "Connect your XRPL wallet before joining a contract" },
        { status: 422 }
      );
    }

    if (contract.investorId === userId) {
      return NextResponse.json({ error: "You cannot join your own contract" }, { status: 403 });
    }

    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Contract is no longer accepting participants" },
        { status: 409 }
      );
    }

    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        startupId: userId,
        status: "AWAITING_ESCROW",
      },
    });

    await prisma.milestone.updateMany({
      where: { contractId: contract.id },
      data: { status: "AWAITING_ESCROW" },
    });

    getPostHogClient().capture({
      distinctId: userId,
      event: "contract_joined",
      properties: { contract_id: updated.id, via: apiKeyCtx ? "api_key" : "session" },
    });

    return NextResponse.json({ contractId: updated.id });
  } catch (err) {
    console.error("Join contract error:", err);
    return NextResponse.json({ error: "Failed to join contract" }, { status: 500 });
  }
}
