/**
 * Adaptive Verification Loop
 * ==========================
 * When a proof is rejected, this service:
 * 1. Reads the structured AI objections from the proof
 * 2. Sends the startup a targeted nudge email: "Here's exactly what's missing"
 * 3. Marks the proof with nudgeCount++ and nudgedAt
 *
 * When the startup re-submits proof addressing the objections, the verify route
 * auto-triggers re-verification without any manual click.
 *
 * Max nudges per proof: 2 (to avoid spam)
 */

import { prisma } from "@/lib/prisma";

export interface Objection {
  code: string;
  description: string;
}

export async function nudgeStartupOnRejection(params: {
  proofId: string;
  contractId: string;
  milestoneId?: string;
  milestoneTitle: string;
  startupEmail: string;
  startupId: string;
  objections: Objection[];
}): Promise<void> {
  const { proofId, contractId, milestoneTitle, startupEmail, startupId, objections } = params;

  const proof = await prisma.proof.findUnique({ where: { id: proofId }, select: { nudgeCount: true } });
  if (!proof) return;
  if (proof.nudgeCount >= 2) return; // don't spam

  await prisma.proof.update({
    where: { id: proofId },
    data: { nudgeCount: { increment: 1 }, nudgedAt: new Date() },
  });

  const { sendAdaptiveNudgeEmail } = await import("@/lib/email");
  await sendAdaptiveNudgeEmail({
    to: startupEmail,
    contractId,
    milestoneTitle,
    objections,
    startupId,
  }).catch((err) => console.warn("[adaptive-loop] nudge email failed:", err));
}
