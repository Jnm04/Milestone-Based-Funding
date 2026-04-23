import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find milestones where consensus deadline has passed but status is still AWAITING_VOTES
  const timedOut = await prisma.milestone.findMany({
    where: {
      consensusEnabled: true,
      consensusStatus: "AWAITING_VOTES",
      consensusDeadline: { lt: now },
    },
    include: {
      consensusVotes: { select: { vote: true } },
    },
  });

  const results: { milestoneId: string; status: string }[] = [];

  for (const milestone of timedOut) {
    const yesVotes = milestone.consensusVotes.filter((v) => v.vote === "YES").length;
    const threshold = milestone.consensusThreshold ?? 1;

    if (yesVotes >= threshold) {
      // Threshold was actually reached before deadline check — mark as REACHED
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { consensusStatus: "REACHED", status: "COMPLETED" },
      });
      results.push({ milestoneId: milestone.id, status: "REACHED" });
    } else {
      await prisma.milestone.update({
        where: { id: milestone.id },
        data: { consensusStatus: "TIMED_OUT", status: "PENDING_REVIEW" },
      });
      results.push({ milestoneId: milestone.id, status: "TIMED_OUT" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
