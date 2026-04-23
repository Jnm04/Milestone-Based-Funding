import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const vote = await prisma.consensusVote.findUnique({
    where: { token },
    include: {
      milestone: {
        select: {
          title: true,
          description: true,
          cancelAfter: true,
          attestationEntries: {
            where: { type: "PLATFORM" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { aiVerdict: true, aiReasoning: true, certUrl: true },
          },
        },
      },
    },
  });

  if (!vote) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

  const latestEntry = vote.milestone.attestationEntries[0] ?? null;

  return NextResponse.json({
    milestoneTitle:       vote.milestone.title,
    milestoneDescription: vote.milestone.description,
    partyRole:            vote.partyRole,
    deadline:             vote.tokenExpiry.toISOString(),
    alreadyVoted:         vote.tokenUsed,
    expired:              new Date() > vote.tokenExpiry,
    aiVerdict:            latestEntry?.aiVerdict ?? null,
    aiReasoning:          latestEntry?.aiReasoning ?? null,
    certUrl:              latestEntry?.certUrl ?? null,
  });
}
