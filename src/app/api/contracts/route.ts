import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { milestone, amountUSD, cancelAfter } = await request.json();

    if (!milestone || !amountUSD || !cancelAfter) {
      return NextResponse.json(
        { error: "milestone, amountUSD and cancelAfter are required" },
        { status: 400 }
      );
    }

    if (!session.user.walletAddress) {
      return NextResponse.json(
        { error: "Connect your XRPL wallet before creating a contract" },
        { status: 422 }
      );
    }

    const investor = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!investor) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const inviteLink = nanoid(12);

    const contract = await prisma.contract.create({
      data: {
        investorId: investor.id,
        milestone,
        amountUSD,
        cancelAfter: new Date(cancelAfter),
        inviteLink,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ contractId: contract.id, inviteLink });
  } catch (err) {
    console.error("Create contract error:", err);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const where =
      session.user.role === "INVESTOR"
        ? { investorId: session.user.id }
        : { startupId: session.user.id };

    const contracts = await prisma.contract.findMany({
      where,
      include: { investor: true, startup: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contracts });
  } catch (err) {
    console.error("List contracts error:", err);
    return NextResponse.json({ error: "Failed to list contracts" }, { status: 500 });
  }
}
