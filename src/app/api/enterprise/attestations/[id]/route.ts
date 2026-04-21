import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isEnterprise) {
    return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      milestones: {
        orderBy: { order: "asc" },
        include: {
          proofs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              aiDecision: true,
              aiReasoning: true,
              aiConfidence: true,
              aiModelVotes: true,
              createdAt: true,
              fileName: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });
  }

  const contractWithLatestProof = {
    ...contract,
    milestones: contract.milestones.map((m) => ({
      ...m,
      latestProof: m.proofs[0] ?? null,
      proofs: undefined,
    })),
  };

  return NextResponse.json({ contract: contractWithLatestProof });
}
