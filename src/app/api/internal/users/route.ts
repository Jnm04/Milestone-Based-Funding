import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      kycTier: true,
      sanctionsStatus: true,
      sanctionsCheckedAt: true,
      emailVerified: true,
      walletAddress: true,
      companyName: true,
      createdAt: true,
      _count: { select: { contracts: true, startupContracts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}
