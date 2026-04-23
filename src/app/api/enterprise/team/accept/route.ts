import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/enterprise/team/accept?token=xxx
 * Accepts a team invite. User must be logged in.
 * Links the current user's account to the org.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=invalid_invite", req.url));

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=/api/enterprise/team/accept?token=${token}`, req.url)
    );
  }

  const invite = await prisma.orgMember.findUnique({
    where: { inviteToken: token },
    include: { owner: { select: { companyName: true } } },
  });

  if (
    !invite ||
    invite.acceptedAt !== null ||
    !invite.inviteExpiry ||
    invite.inviteExpiry < new Date()
  ) {
    return NextResponse.redirect(new URL("/enterprise/dashboard?invite=expired", req.url));
  }

  // Accept invite: link the current user, clear token
  await prisma.orgMember.update({
    where: { id: invite.id },
    data: {
      memberId: session.user.id,
      acceptedAt: new Date(),
      inviteToken: null,
      inviteExpiry: null,
    },
  });

  // Grant enterprise access so team member can access the enterprise dashboard
  await prisma.user.update({
    where: { id: session.user.id },
    data: { isEnterprise: true },
  });

  return NextResponse.redirect(new URL("/enterprise/dashboard?invite=accepted", req.url));
}
