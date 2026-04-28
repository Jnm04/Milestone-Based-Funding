import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/enterprise/attestations/[id]/connector-health
 * Returns the latest health check result for every milestone in this contract.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, milestones: { select: { id: true, title: true, connectorStatus: true, connectorLastHealthy: true, dataSourceType: true, dataSourceUrl: true } } },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.investorId !== auth.userId) {
    // also allow org members
    const member = await prisma.orgMember.findFirst({
      where: { ownerId: contract.investorId, memberId: auth.userId, acceptedAt: { not: null } },
    });
    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch the most recent health check per milestone
  const milestoneIds = contract.milestones.map((m) => m.id);
  const recentChecks = await prisma.connectorHealthCheck.findMany({
    where: { milestoneId: { in: milestoneIds } },
    orderBy: { checkedAt: "desc" },
  });

  // Group by milestoneId — keep only the latest per milestone
  const latestByMilestone = new Map<string, typeof recentChecks[0]>();
  for (const check of recentChecks) {
    if (!latestByMilestone.has(check.milestoneId)) {
      latestByMilestone.set(check.milestoneId, check);
    }
  }

  const health = contract.milestones
    .filter((m) => m.dataSourceType === "REST_API" || m.dataSourceType === "URL_SCRAPE")
    .map((m) => ({
      milestoneId: m.id,
      title: m.title,
      connectorUrl: m.dataSourceUrl,
      status: m.connectorStatus ?? "UNKNOWN",
      lastHealthy: m.connectorLastHealthy,
      latestCheck: latestByMilestone.get(m.id) ?? null,
    }));

  return NextResponse.json({ health });
}
