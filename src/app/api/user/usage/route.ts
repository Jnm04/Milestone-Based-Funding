import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

// GET /api/user/usage — usage stats for the current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const uid = session.user.id;

  const [
    contractsAsInvestor,
    contractsAsStartup,
    milestones,
    proofCount,
    memberSince,
  ] = await Promise.all([
    prisma.contract.count({ where: { investorId: uid } }),
    prisma.contract.count({ where: { startupId: uid } }),
    prisma.milestone.findMany({
      where: {
        contract: { OR: [{ investorId: uid }, { startupId: uid }] },
      },
      select: { status: true },
    }),
    prisma.proof.count({
      where: {
        contract: { OR: [{ investorId: uid }, { startupId: uid }] },
      },
    }),
    prisma.user.findUnique({ where: { id: uid }, select: { createdAt: true } }),
  ]);

  const milestoneCounts = milestones.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    contractsAsInvestor,
    contractsAsStartup,
    totalMilestones: milestones.length,
    milestonesVerified: milestoneCounts["VERIFIED"] ?? 0,
    milestonesCompleted: milestoneCounts["COMPLETED"] ?? 0,
    milestonesRejected: milestoneCounts["REJECTED"] ?? 0,
    milestonesPending: (milestoneCounts["PENDING"] ?? 0) + (milestoneCounts["FUNDED"] ?? 0) + (milestoneCounts["PROOF_SUBMITTED"] ?? 0),
    proofCount,
    memberSince: memberSince?.createdAt ?? null,
  });
}
