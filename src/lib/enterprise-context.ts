import { prisma } from "@/lib/prisma";

export interface EnterpriseContext {
  effectiveUserId: string;
  isTeamMember: boolean;
  ownerName: string | null;
  ownerCompany: string | null;
  role: string;
}

/**
 * Returns the "effective" owner ID for enterprise dashboard queries.
 * If the user is a team member of another org, returns the owner's userId.
 * Otherwise returns the user's own ID.
 */
export async function getEnterpriseContext(userId: string): Promise<EnterpriseContext> {
  const membership = await prisma.orgMember.findFirst({
    where: { memberId: userId, acceptedAt: { not: null } },
    include: { owner: { select: { id: true, name: true, companyName: true } } },
  });

  if (membership) {
    return {
      effectiveUserId: membership.ownerId,
      isTeamMember: true,
      ownerName: membership.owner.name,
      ownerCompany: membership.owner.companyName,
      role: membership.role,
    };
  }

  return {
    effectiveUserId: userId,
    isTeamMember: false,
    ownerName: null,
    ownerCompany: null,
    role: "OWNER",
  };
}
