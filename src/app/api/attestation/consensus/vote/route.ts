import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkConsensusThreshold, recordVoteOnChain } from "@/lib/consensus";
import { z } from "zod";

const schema = z.object({
  token:     z.string().min(1).max(128),
  vote:      z.enum(["YES", "NO", "ABSTAIN"]),
  reasoning: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rlAllowed = await checkRateLimit(`consensus-vote:${ip}`, 10, 60);
  if (!rlAllowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { token, vote, reasoning } = parsed.data;

  const consensusVote = await prisma.consensusVote.findUnique({
    where: { token },
    include: { milestone: { include: { contract: { select: { id: true } } } } },
  });

  if (!consensusVote) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (consensusVote.tokenUsed) return NextResponse.json({ error: "This vote link has already been used" }, { status: 409 });
  if (new Date() > consensusVote.tokenExpiry) {
    return NextResponse.json({ error: "This vote link has expired" }, { status: 410 });
  }

  const xrplTxHash = await recordVoteOnChain(
    consensusVote.milestoneId,
    consensusVote.milestone.contract.id,
    consensusVote.id,
    consensusVote.partyRole,
    vote
  );

  await prisma.consensusVote.update({
    where: { id: consensusVote.id },
    data: {
      vote,
      reasoning: reasoning ?? null,
      votedAt: new Date(),
      tokenUsed: true,
      xrplTxHash,
    },
  });

  await checkConsensusThreshold(consensusVote.milestoneId);

  return NextResponse.json({ success: true, vote, xrplTxHash });
}
