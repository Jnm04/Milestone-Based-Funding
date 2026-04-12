import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuspiciousName } from "@/lib/validate-name";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "100")), 500);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0"));

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
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
      take: limit,
      skip: offset,
    }),
  ]);

  const enriched = users.map((u) => ({
    ...u,
    nameFlagged: isSuspiciousName(u.name) || isSuspiciousName(u.companyName),
  }));

  return NextResponse.json({ users: enriched, total, limit, offset });
}
