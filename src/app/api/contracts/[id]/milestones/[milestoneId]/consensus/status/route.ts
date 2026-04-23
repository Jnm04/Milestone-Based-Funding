import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: { select: { id: true, investorId: true, auditorEmail: true } },
      consensusVotes: {
        select: { id: true, partyEmail: true, partyRole: true, vote: true, votedAt: true, xrplTxHash: true, tokenUsed: true },
      },
    },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    milestone.contract.investorId !== session.user.id &&
    milestone.contract.auditorEmail !== session.user.email
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const votes = milestone.consensusVotes;
  const yesVotes  = votes.filter((v) => v.vote === "YES").length;
  const noVotes   = votes.filter((v) => v.vote === "NO").length;
  const pendingVotes = votes.filter((v) => !v.tokenUsed).length;

  return NextResponse.json({
    consensusEnabled:   milestone.consensusEnabled,
    consensusThreshold: milestone.consensusThreshold,
    consensusStatus:    milestone.consensusStatus,
    consensusDeadline:  milestone.consensusDeadline,
    yesVotes,
    noVotes,
    pendingVotes,
    totalParties: votes.length,
    votes: votes.map((v) => ({
      id: v.id,
      partyRole: v.partyRole,
      // Never expose emails to non-owners
      partyEmail: milestone.contract.investorId === session.user.id ? v.partyEmail : v.partyEmail.replace(/(.{2}).*@/, "$1***@"),
      vote: v.vote,
      votedAt: v.votedAt,
      xrplTxHash: v.xrplTxHash,
    })),
  });
}
