import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuspiciousName } from "@/lib/validate-name";
import { isInternalAuthorized } from "@/lib/internal-auth";


export async function GET(request: NextRequest) {
  if (!isInternalAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? "");
  const limit = Math.min(Math.max(1, Number.isNaN(limitRaw) ? 100 : limitRaw), 500);
  const offsetRaw = parseInt(searchParams.get("offset") ?? "");
  const offset = Math.max(0, Number.isNaN(offsetRaw) ? 0 : offsetRaw);

  try {
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
  } catch (err) {
    console.error("[internal/users] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
