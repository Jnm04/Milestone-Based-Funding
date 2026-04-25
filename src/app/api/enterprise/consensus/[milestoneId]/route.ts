import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { milestoneId } = await params;
  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: { select: { investorId: true } },
      consensusVotes: {
        orderBy: { tokenExpiry: "desc" },
        select: {
          id: true,
          partyEmail: true,
          partyRole: true,
          vote: true,
          reasoning: true,
          votedAt: true,
          tokenUsed: true,
          tokenExpiry: true,
          xrplTxHash: true,
        },
      },
    },
  });

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (milestone.contract.investorId !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    milestone: {
      id: milestone.id,
      title: milestone.title,
      consensusEnabled: milestone.consensusEnabled,
      consensusThreshold: milestone.consensusThreshold,
      consensusStatus: milestone.consensusStatus,
      consensusDeadline: milestone.consensusDeadline,
    },
    votes: milestone.consensusVotes,
  });
}
