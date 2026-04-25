import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/startup/[username]
 * Public — no auth required. Returns a startup's public profile data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  // Rate limit: 60 req/min per IP — prevents username enumeration
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`startup-profile:${ip}`, 60, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { username } = await params;

  const user = await prisma.user.findUnique({
    where: { publicUsername: username },
    select: {
      id: true,
      name: true,
      companyName: true,
      companyBio: true,
      companyWebsite: true,
      linkedinUrl: true,
      publicProfile: true,
      verifiedBadgeNftId: true,
      createdAt: true,
      startupContracts: {
        where: { mode: "ESCROW", status: "COMPLETED" },
        select: {
          id: true,
          milestones: {
            where: { status: "COMPLETED" },
            select: {
              id: true,
              title: true,
              amountUSD: true,
              nftTokenId: true,
              nftImageUrl: true,
              nftTxHash: true,
              reputationSummary: true,
              reputationCategory: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.publicProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Aggregate stats
  const completedMilestones = user.startupContracts.flatMap((c) => c.milestones);
  const totalRlusd = completedMilestones.reduce(
    (sum, m) => sum + Number(m.amountUSD),
    0
  );

  return NextResponse.json({
    profile: {
      username,
      name: user.name,
      companyName: user.companyName,
      bio: user.companyBio,
      website: user.companyWebsite,
      linkedinUrl: user.linkedinUrl,
      verifiedBadgeNftId: user.verifiedBadgeNftId,
      memberSince: user.createdAt,
      stats: {
        milestonesCompleted: completedMilestones.length,
        totalRlusdReceived: totalRlusd,
      },
      milestones: completedMilestones.map((m) => ({
        id: m.id,
        title: m.title,
        amountUSD: m.amountUSD,
        nftTokenId: m.nftTokenId,
        nftImageUrl: m.nftImageUrl,
        reputationSummary: m.reputationSummary,
        reputationCategory: m.reputationCategory,
      })),
    },
  });
}
