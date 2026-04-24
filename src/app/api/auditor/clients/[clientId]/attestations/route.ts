import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auditor/clients/[clientId]/attestations
 * Returns a client's attestation contracts in read-only mode.
 * Only accessible by auditors with active access grants.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;

  // Verify auditor has active access to this client
  const auditorPartner = await prisma.auditorPartner.findUnique({
    where: { userId: session.user.id },
  });
  if (!auditorPartner) return NextResponse.json({ error: "Auditor partner account required" }, { status: 403 });

  const access = await prisma.auditorClientAccess.findFirst({
    where: { auditorId: auditorPartner.id, clientId, revokedAt: null },
  });
  if (!access) return NextResponse.json({ error: "Access not granted" }, { status: 403 });

  const contracts = await prisma.contract.findMany({
    where: { investorId: clientId, mode: "ATTESTATION" },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          attestationEntries: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              period: true,
              fetchedAt: true,
              aiVerdict: true,
              aiReasoning: true,
              xrplTxHash: true,
              certUrl: true,
              type: true,
            },
          },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, event: true, evmTxHash: true, xrplTxHash: true, actor: true, metadata: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contracts });
}
