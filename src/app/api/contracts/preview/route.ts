import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const invite = new URL(request.url).searchParams.get("invite");
  if (!invite) {
    return NextResponse.json({ error: "invite param required" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { inviteLink: invite },
    include: {
      investor: true,
      milestones: { orderBy: { order: "asc" } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Mask wallet: show only first 6 and last 4 chars to prevent chain analysis
  const wallet = contract.investor.walletAddress ?? "";
  const maskedWallet = wallet.length > 10
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : "****";

  return NextResponse.json({
    id: contract.id,
    milestone: contract.milestone,
    amountUSD: contract.amountUSD.toString(),
    status: contract.status,
    cancelAfter: contract.cancelAfter,
    investorWallet: maskedWallet,
    milestones: contract.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amountUSD: m.amountUSD.toString(),
      cancelAfter: m.cancelAfter.toISOString(),
      order: m.order,
    })),
  });
}
