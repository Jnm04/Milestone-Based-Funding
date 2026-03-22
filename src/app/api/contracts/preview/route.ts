import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const invite = new URL(request.url).searchParams.get("invite");
  if (!invite) {
    return NextResponse.json({ error: "invite param required" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { inviteLink: invite },
    include: { investor: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: contract.id,
    milestone: contract.milestone,
    amountUSD: contract.amountUSD,
    status: contract.status,
    cancelAfter: contract.cancelAfter,
    investorWallet: contract.investor.walletAddress,
  });
}
