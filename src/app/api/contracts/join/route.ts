import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { inviteCode, startupAddress } = await request.json();

    if (!inviteCode || !startupAddress) {
      return NextResponse.json(
        { error: "inviteCode and startupAddress are required" },
        { status: 400 }
      );
    }

    const contract = await prisma.contract.findUnique({
      where: { inviteLink: inviteCode },
    });

    if (!contract) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Contract is no longer accepting participants" },
        { status: 409 }
      );
    }

    // Upsert startup user
    const startup = await prisma.user.upsert({
      where: { walletAddress: startupAddress },
      update: {},
      create: { walletAddress: startupAddress, role: "STARTUP" },
    });

    // Link startup to contract
    const updated = await prisma.contract.update({
      where: { id: contract.id },
      data: {
        startupId: startup.id,
        status: "AWAITING_ESCROW",
      },
    });

    return NextResponse.json({ contractId: updated.id });
  } catch (err) {
    console.error("Join contract error:", err);
    return NextResponse.json({ error: "Failed to join contract" }, { status: 500 });
  }
}
