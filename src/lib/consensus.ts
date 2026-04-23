import { prisma } from "@/lib/prisma";
import { writeXrplAuditMemo } from "@/services/xrpl/audit-xrpl.service";
import { sendConsensusReachedEmail } from "@/lib/email";

export async function checkConsensusThreshold(milestoneId: string): Promise<void> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      contract: { select: { id: true, investorId: true, investor: { select: { email: true } } } },
      consensusVotes: true,
    },
  });
  if (!milestone || !milestone.consensusEnabled || !milestone.consensusThreshold) return;

  const votes = milestone.consensusVotes;
  const totalParties = votes.length;
  const yesCount = votes.filter((v) => v.vote === "YES").length;
  const noCount  = votes.filter((v) => v.vote === "NO").length;
  const threshold = milestone.consensusThreshold;

  if (yesCount >= threshold) {
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { consensusStatus: "REACHED", status: "COMPLETED" },
    });

    const ownerEmail = milestone.contract.investor.email;
    if (ownerEmail) {
      const certUrl = milestone.attestationCertUrl;
      await sendConsensusReachedEmail({
        to: ownerEmail,
        milestoneTitle: milestone.title,
        contractId: milestone.contract.id,
        yesVotes: yesCount,
        totalParties,
        certUrl: certUrl ?? null,
      }).catch(() => {});
    }
  } else if (noCount > totalParties - threshold) {
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { consensusStatus: "FAILED", status: "REJECTED" },
    });
  }
}

export async function recordVoteOnChain(
  milestoneId: string,
  contractId: string,
  voteId: string,
  partyRole: string,
  vote: string
): Promise<string | null> {
  return writeXrplAuditMemo({
    event: "CONSENSUS_VOTE",
    contractId,
    milestoneId,
    actor: partyRole,
    metadata: { voteId, vote },
  });
}
