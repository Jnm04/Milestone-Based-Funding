import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user/export
 *
 * GDPR Subject Access Request — exports all data we hold about the current user.
 * Returns a JSON file as a download attachment.
 * Sensitive fields (passwordHash, reset tokens) are stripped.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      walletAddress: true,
      companyName: true,
      department: true,
      jobTitle: true,
      phone: true,
      bio: true,
      website: true,
      createdAt: true,
      emailVerified: true,
      kycTier: true,
      sanctionsStatus: true,
      sanctionsCheckedAt: true,
      notifyProofSubmitted: true,
      notifyPendingReview: true,
      notifyMilestoneCompleted: true,
      notifyFunded: true,
      notifyVerified: true,
      notifyRejected: true,
      // Intentionally excluded: passwordHash, emailVerificationToken, passwordResetToken, loginAttempts, lockoutUntil
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
  }

  // All contracts where user is investor or startup (capped to prevent oversized exports)
  const contracts = await prisma.contract.findMany({
    where: { OR: [{ investorId: session.user.id }, { startupId: session.user.id }] },
    select: {
      id: true,
      milestone: true,
      amountUSD: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      inviteLink: true,
      milestones: {
        select: {
          id: true,
          title: true,
          amountUSD: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // All proofs from those contracts (capped to prevent OOM in serverless)
  const contractIds = contracts.map((c) => c.id);
  const proofs = await prisma.proof.findMany({
    where: { contractId: { in: contractIds } },
    select: {
      id: true,
      contractId: true,
      milestoneId: true,
      fileName: true,
      fileUrl: true,
      proofType: true,
      proofUrl: true,
      aiDecision: true,
      aiReasoning: true,
      aiConfidence: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  // Audit log entries
  const auditLogs = await prisma.auditLog.findMany({
    where: { contractId: { in: contractIds } },
    select: {
      id: true,
      contractId: true,
      milestoneId: true,
      event: true,
      actor: true,
      createdAt: true,
      evmTxHash: true,
      xrplTxHash: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500, // cap to prevent excessively large exports
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
    user,
    contracts,
    proofs,
    auditLogs,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cascrow-data-export-${session.user.id}.json"`,
    },
  });
}
