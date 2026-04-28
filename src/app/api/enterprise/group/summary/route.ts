import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const org = await prisma.organisation.findUnique({
    where: { ownerId: effectiveUserId },
    include: { entities: { orderBy: { createdAt: "asc" } } },
  });

  // All team members with entityId
  const members = await prisma.orgMember.findMany({
    where: { ownerId: effectiveUserId, acceptedAt: { not: null } },
    select: { id: true, email: true, name: true, role: true, entityId: true },
  });

  // All contracts for the owner
  const contracts = await prisma.contract.findMany({
    where: { investorId: effectiveUserId },
    include: { milestones: { select: { id: true, status: true, cancelAfter: true } } },
  });

  const totalContracts = contracts.length;
  const totalMilestones = contracts.reduce((s, c) => s + c.milestones.length, 0);
  const verifiedCount = contracts.reduce(
    (s, c) => s + c.milestones.filter((m) => ["VERIFIED", "COMPLETED"].includes(m.status)).length,
    0,
  );
  const activeCount = contracts.reduce(
    (s, c) => s + c.milestones.filter((m) => ["FUNDED", "PROOF_SUBMITTED"].includes(m.status)).length,
    0,
  );

  const entitySummaries = (org?.entities ?? []).map((entity) => {
    const entityMemberIds = members.filter((m) => m.entityId === entity.id).map((m) => m.id);
    return {
      id: entity.id,
      name: entity.name,
      parentEntityId: entity.parentEntityId,
      memberCount: entityMemberIds.length,
    };
  });

  return NextResponse.json({
    org: org ? { id: org.id, name: org.name, plan: org.plan } : null,
    summary: { totalContracts, totalMilestones, verifiedCount, activeCount },
    entities: entitySummaries,
    members,
  });
}
