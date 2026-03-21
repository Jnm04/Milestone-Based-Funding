import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const { investorAddress, startupAddress, milestone, amountUSD, cancelAfter } =
      await request.json();

    if (!investorAddress || !milestone || !amountUSD || !cancelAfter) {
      return NextResponse.json(
        { error: "investorAddress, milestone, amountUSD and cancelAfter are required" },
        { status: 400 }
      );
    }

    // Upsert investor
    const investor = await prisma.user.upsert({
      where: { walletAddress: investorAddress },
      update: {},
      create: { walletAddress: investorAddress, role: "INVESTOR" },
    });

    // Upsert startup if address provided
    let startupId: string | undefined;
    if (startupAddress) {
      const startup = await prisma.user.upsert({
        where: { walletAddress: startupAddress },
        update: {},
        create: { walletAddress: startupAddress, role: "STARTUP" },
      });
      startupId = startup.id;
    }

    const inviteLink = nanoid(12);

    const contract = await prisma.contract.create({
      data: {
        investorId: investor.id,
        startupId,
        milestone,
        amountUSD,
        cancelAfter: new Date(cancelAfter),
        inviteLink,
        // If startup is already known, skip DRAFT and go straight to AWAITING_ESCROW
        status: startupId ? "AWAITING_ESCROW" : "DRAFT",
      },
    });

    return NextResponse.json({
      contractId: contract.id,
      inviteLink,
    });
  } catch (err) {
    console.error("Create contract error:", err);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("wallet");

    if (!walletAddress) {
      return NextResponse.json({ error: "wallet param required" }, { status: 400 });
    }

    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { investor: { walletAddress } },
          { startup: { walletAddress } },
        ],
      },
      include: { investor: true, startup: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contracts });
  } catch (err) {
    console.error("List contracts error:", err);
    return NextResponse.json({ error: "Failed to list contracts" }, { status: 500 });
  }
}
