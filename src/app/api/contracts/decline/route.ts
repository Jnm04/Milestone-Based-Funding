import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteCode } = await req.json();
  if (!inviteCode) return NextResponse.json({ error: "Missing inviteCode" }, { status: 400 });

  const contract = await prisma.contract.findUnique({ where: { inviteLink: inviteCode } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.status !== "DRAFT") return NextResponse.json({ error: "Contract is no longer pending" }, { status: 409 });
  // The investor cannot decline their own contract via the startup invite link
  if (contract.investorId === session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: { status: "DECLINED" },
  });

  return NextResponse.json({ ok: true });
}
