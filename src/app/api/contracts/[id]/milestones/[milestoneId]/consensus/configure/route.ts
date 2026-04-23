import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import { sendConsensusVoteInviteEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  enabled:   z.boolean(),
  threshold: z.number().int().min(1).max(10),
  deadline:  z.string().datetime(),
  parties:   z.array(z.object({
    role:  z.enum(["AUDITOR", "REGULATOR", "INVESTOR", "COMMITTEE"]),
    email: z.string().email(),
  })).min(1).max(9),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkRateLimit(`consensus-configure:${session.user.id}`, 10, 3600))) {
    return NextResponse.json({ error: "Rate limit exceeded — 10/hour" }, { status: 429 });
  }

  const { id: contractId, milestoneId } = await params;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { id: true, investorId: true, mode: true } } },
  });

  if (!milestone || milestone.contractId !== contractId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (milestone.contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (milestone.contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Consensus is only available for ATTESTATION milestones" }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { enabled, threshold, deadline, parties } = parsed.data;
  const deadlineDate = new Date(deadline);
  const tokenExpiry = deadlineDate;

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      consensusEnabled: enabled,
      consensusThreshold: threshold,
      consensusDeadline: deadlineDate,
      consensusStatus: enabled ? "AWAITING_VOTES" : null,
    },
  });

  // Delete old pending votes before creating new ones
  await prisma.consensusVote.deleteMany({
    where: { milestoneId, tokenUsed: false },
  });

  const votes = await Promise.all(
    parties.map(async (party) => {
      const token = crypto.randomBytes(32).toString("hex");
      const vote = await prisma.consensusVote.create({
        data: {
          milestoneId,
          partyEmail: party.email,
          partyRole: party.role,
          token,
          tokenExpiry,
          tokenUsed: false,
        },
      });
      await sendConsensusVoteInviteEmail({
        to: party.email,
        milestoneTitle: milestone.title,
        contractId,
        partyRole: party.role,
        voteToken: token,
        deadline: deadlineDate,
      }).catch((err) => console.warn("[consensus/configure] email failed:", err));
      return vote;
    })
  );

  return NextResponse.json({ consensusEnabled: enabled, threshold, parties: votes.length }, { status: 200 });
}
