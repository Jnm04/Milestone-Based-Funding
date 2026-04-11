import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { screenName } from "@/services/sanctions/sanctions.service";

/**
 * POST /api/user/recheck-kyc
 * Re-runs sanctions screening for the current user and upgrades tier if CLEAR.
 * Rate-limited: only runs if last check was >1 hour ago.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, dateOfBirth: true, kycTier: true, sanctionsCheckedAt: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Rate limit: 1 hour between checks
  if (user.sanctionsCheckedAt) {
    const msSince = Date.now() - user.sanctionsCheckedAt.getTime();
    if (msSince < 60 * 60 * 1000) {
      const waitMin = Math.ceil((60 * 60 * 1000 - msSince) / 60_000);
      return NextResponse.json(
        { error: `Screening was run recently. Try again in ${waitMin} minute${waitMin !== 1 ? "s" : ""}.` },
        { status: 429 }
      );
    }
  }

  const target = user.name ?? user.email.split("@")[0];
  const result = await screenName(target, user.dateOfBirth ?? null);

  const newTier = result.hit ? user.kycTier : Math.max(user.kycTier, 1);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      sanctionsCheckedAt: new Date(),
      sanctionsStatus: result.hit ? "HIT" : "CLEAR",
      kycTier: newTier,
    },
  });

  return NextResponse.json({
    sanctionsStatus: result.hit ? "HIT" : "CLEAR",
    kycTier: newTier,
  });
}
