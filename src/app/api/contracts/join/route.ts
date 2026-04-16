import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 10 join attempts per user per hour — prevents invite-code brute-forcing
    const ip = getClientIp(request) ?? "unknown";
    if (!checkRateLimit(`join-contract:${session.user.id}:${ip}`, 10, 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    if (session.user.role !== "STARTUP") {
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

    if (!session.user.walletAddress) {
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

    if (contract.investorId === session.user.id) {
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
        startupId: session.user.id,
        status: "AWAITING_ESCROW",
      },
    });

    // Activate all milestones for upfront funding
    await prisma.milestone.updateMany({
      where: { contractId: contract.id },
      data: { status: "AWAITING_ESCROW" },
    });

    return NextResponse.json({ contractId: updated.id });
  } catch (err) {
    console.error("Join contract error:", err);
    return NextResponse.json({ error: "Failed to join contract" }, { status: 500 });
  }
}
