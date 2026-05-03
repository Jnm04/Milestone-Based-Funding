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
    const apiKeyCtx = session ? null : await resolveApiKey(request.headers.get("authorization"));

    if (!session && !apiKeyCtx) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session ? session.user.id : apiKeyCtx!.userId;
    const isApiKey = !session;

    // 10 join attempts per user per hour — prevents invite-code brute-forcing.
    // API key callers omit IP: serverless agents rotate NAT IPs per invocation so
    // the composite key would give them 10×(pool size) effective attempts, not 10.
    // The API key itself is the stable, cryptographically-bound identity.
    const ip = getClientIp(request) ?? "unknown";
    const rateLimitKey = isApiKey ? `join-contract:${userId}` : `join-contract:${userId}:${ip}`;
    if (!(await checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // API key callers are builders by default — no role DB lookup needed
    if (!isApiKey && session!.user.role !== "STARTUP") {
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

    // Wallet check only applies to browser sessions — agents never have MetaMask
    if (!isApiKey && !session!.user.walletAddress) {
      return NextResponse.json(
        { error: "Connect your XRPL wallet before joining a contract" },
        { status: 422 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { inviteLink: inviteCode },
    });

    if (!contract) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
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

    // Activate all milestones for upfront funding
    await prisma.milestone.updateMany({
      where: { contractId: contract.id },
      data: { status: "AWAITING_ESCROW" },
    });

    getPostHogClient().capture({
      distinctId: userId,
      event: "contract_joined",
      properties: { contract_id: updated.id },
    });

    return NextResponse.json({ contractId: updated.id });
  } catch (err) {
    console.error("Join contract error:", err);
    return NextResponse.json({ error: "Failed to join contract" }, { status: 500 });
  }
}
