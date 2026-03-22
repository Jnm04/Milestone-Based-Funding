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

    const { milestone, amountUSD, cancelAfter, milestones: milestonesInput } = await request.json();

    // Need at least a milestone title/description
    if (!milestone && (!milestonesInput || milestonesInput.length === 0)) {
      return NextResponse.json(
        { error: "milestone or milestones array is required" },
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

    const result = await prisma.$transaction(async (tx) => {
      const msData: { title: string; amountUSD: number; cancelAfter: string }[] =
        milestonesInput ?? [{ title: milestone, amountUSD, cancelAfter }];

      const totalAmount = msData.reduce(
        (sum: number, m: { amountUSD: number }) => sum + Number(m.amountUSD),
        0
      );
      const latestDeadline = msData.reduce(
        (latest: string, m: { cancelAfter: string }) =>
          m.cancelAfter > latest ? m.cancelAfter : latest,
        msData[0].cancelAfter
      );

      const contract = await tx.contract.create({
        data: {
          investorId: investor.id,
          milestone: milestone ?? msData[0].title,
          amountUSD: totalAmount,
          cancelAfter: new Date(latestDeadline),
          inviteLink,
          status: "DRAFT",
        },
      });

      await tx.milestone.createMany({
        data: msData.map(
          (m: { title: string; amountUSD: number; cancelAfter: string }, i: number) => ({
            contractId: contract.id,
            title: m.title,
            amountUSD: m.amountUSD,
            cancelAfter: new Date(m.cancelAfter),
            order: i,
            status: "PENDING",
          })
        ),
      });

      return contract;
    });

    return NextResponse.json({ contractId: result.id, inviteLink });
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
