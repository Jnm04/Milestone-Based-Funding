import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const invite = new URL(request.url).searchParams.get("invite");
  if (!invite) {
    return NextResponse.json({ error: "invite param required" }, { status: 400 });
  }

  // Reject malformed invite codes before hitting the DB.
  // nanoid generates alphanumeric + _- characters. Valid range: 6–32 chars.
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(invite)) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const contract = await prisma.contract.findUnique({
    where: { inviteLink: invite },
    select: {
      id: true,
      milestone: true,
      amountUSD: true,
      status: true,
      cancelAfter: true,
      milestones: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, amountUSD: true, cancelAfter: true, order: true },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: contract.id,
    milestone: contract.milestone,
    amountUSD: contract.amountUSD.toString(),
    status: contract.status,
    cancelAfter: contract.cancelAfter,
    milestones: contract.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      amountUSD: m.amountUSD.toString(),
      cancelAfter: m.cancelAfter.toISOString(),
      order: m.order,
    })),
  });
}
