import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { milestone, amountUSD, cancelAfter, milestones: milestonesInput, receiverWalletAddress } = await request.json();

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

    // KYC tier limits
    const KYC_LIMITS: Record<number, number> = { 0: 1_000, 1: 10_000 };
    const tierLimit = KYC_LIMITS[investor.kycTier];
    if (tierLimit !== undefined) {
      const msData_pre: { amountUSD: number }[] =
        (milestonesInput ?? [{ amountUSD }]).map((m: { amountUSD: unknown }) => ({ amountUSD: Number(m.amountUSD) }));
      const totalUSD = msData_pre.reduce((sum, m) => sum + m.amountUSD, 0);
      if (totalUSD > tierLimit) {
        const tierLabel = investor.kycTier === 0
          ? "Email-verified accounts (Tier 0) are limited to $1,000 per contract. Complete name & sanctions screening to increase your limit to $10,000."
          : `Your current verification level (Tier ${investor.kycTier}) allows up to $${tierLimit.toLocaleString()} per contract.`;
        return NextResponse.json({ error: tierLabel, kycTier: investor.kycTier, limit: tierLimit }, { status: 403 });
      }
    }

    // If a receiver wallet was provided, look up that user now
    let receiver: { id: string } | null = null;
    if (receiverWalletAddress) {
      receiver = await prisma.user.findUnique({
        where: { walletAddress: receiverWalletAddress },
      });
      if (!receiver) {
        return NextResponse.json(
          { error: "No account found with that wallet address. The Receiver must register first." },
          { status: 404 }
        );
      }
    }

    const inviteLink = nanoid(12);

    // Validate amounts before entering the transaction
    const msData: { title: string; amountUSD: number; cancelAfter: string }[] =
      milestonesInput ?? [{ title: milestone, amountUSD, cancelAfter }];

    for (const m of msData) {
      const amt = Number(m.amountUSD);
      if (!Number.isFinite(amt) || amt <= 0 || amt > 999_999_999) {
        return NextResponse.json({ error: "Invalid amount: must be between 0 and 999,999,999" }, { status: 400 });
      }
      if (Math.round(amt * 100) !== amt * 100) {
        return NextResponse.json({ error: "Invalid amount: max 2 decimal places allowed" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const totalAmount = msData.reduce(
        (sum: number, m: { amountUSD: number }) => sum + Number(m.amountUSD),
        0
      );
      const latestDeadline = msData.reduce(
        (latest: string, m: { cancelAfter: string }) =>
          m.cancelAfter > latest ? m.cancelAfter : latest,
        msData[0].cancelAfter
      );

      const directLink = receiver ? null : inviteLink;
      const contractStatus = receiver ? "AWAITING_ESCROW" : "DRAFT";
      const milestoneStatus = receiver ? "AWAITING_ESCROW" : "PENDING";

      const contract = await tx.contract.create({
        data: {
          investorId: investor.id,
          startupId: receiver?.id ?? null,
          milestone: milestone ?? msData[0].title,
          amountUSD: totalAmount,
          cancelAfter: new Date(latestDeadline),
          inviteLink: directLink,
          status: contractStatus,
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
            status: milestoneStatus,
          })
        ),
      });

      return contract;
    });

    await writeAuditLog({
      contractId: result.id,
      event: "CONTRACT_CREATED",
      actor: session.user.id,
      metadata: { milestoneCount: result.id ? 1 : 0 },
    });

    fireWebhook({
      investorId: investor.id,
      startupId: receiver?.id ?? undefined,
      event: "contract.created",
      contractId: result.id,
      data: {
        milestone: milestone ?? result.milestone,
        amountUSD: result.amountUSD.toString(),
        cancelAfter: result.cancelAfter.toISOString(),
      },
    }).catch((err) => console.error("[webhook] contract.created failed:", err));

    return NextResponse.json({
      contractId: result.id,
      inviteLink: receiver ? null : inviteLink,
      directlyLinked: !!receiver,
    });
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
      include: {
        investor: true,
        startup: true,
        milestones: { select: { status: true }, orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ contracts });
  } catch (err) {
    console.error("List contracts error:", err);
    return NextResponse.json({ error: "Failed to list contracts" }, { status: 500 });
  }
}
