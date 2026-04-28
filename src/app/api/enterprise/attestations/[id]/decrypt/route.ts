import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";
import { decryptGoal } from "@/lib/confidential";

/**
 * POST /api/enterprise/attestations/[id]/decrypt
 * Auditor or owner submits a passphrase to decrypt a confidential attestation goal.
 * Decryption happens server-side — the plaintext is returned in the response but never stored.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json() as { passphrase?: string; milestoneId?: string };

  if (!body.passphrase) {
    return NextResponse.json({ error: "Passphrase is required" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      investorId: true,
      milestones: {
        where: body.milestoneId ? { id: body.milestoneId } : undefined,
        select: { id: true, title: true, isConfidential: true, encryptedGoal: true, goalHash: true },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Allow owner, org members, or connected auditors
  const isOwner = contract.investorId === auth.userId;
  let hasAccess = isOwner;

  if (!hasAccess) {
    const orgMember = await prisma.orgMember.findFirst({
      where: { ownerId: contract.investorId, memberId: auth.userId, acceptedAt: { not: null } },
    });
    hasAccess = !!orgMember;
  }

  if (!hasAccess) {
    const auditorAccess = await prisma.auditorClientAccess.findFirst({
      where: {
        clientId: contract.investorId,
        auditor: { userId: auth.userId },
        revokedAt: null,
      },
    });
    hasAccess = !!auditorAccess;
  }

  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results: Array<{ milestoneId: string; title: string; description: string; goalHash: string | null }> = [];

  for (const milestone of contract.milestones) {
    if (!milestone.isConfidential || !milestone.encryptedGoal) continue;

    try {
      const decrypted = decryptGoal(milestone.encryptedGoal, body.passphrase);
      results.push({
        milestoneId: milestone.id,
        title: decrypted.title,
        description: decrypted.description,
        goalHash: milestone.goalHash,
      });
    } catch {
      return NextResponse.json({ error: "Incorrect passphrase" }, { status: 422 });
    }
  }

  if (results.length === 0) {
    return NextResponse.json({ error: "No confidential milestones found" }, { status: 404 });
  }

  return NextResponse.json({ milestones: results });
}
