import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { resolveApiKey } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

// GET /api/mobile/contracts/[id]
// Returns full contract details for the mobile app.
// Separate from /api/contracts/[id] which returns minimal data for the web poller.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getMobileSession(req);
  const apiKeyCtx = !session ? await resolveApiKey(req.headers.get("authorization")) : null;
  const userId = session?.user?.id ?? apiKeyCtx?.userId ?? null;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id, deletedAt: null },
    select: {
      id: true,
      milestone: true,
      status: true,
      mode: true,
      amountUSD: true,
      cancelAfter: true,
      inviteLink: true,
      evmTxHash: true,
      nftTokenId: true,
      nftTxHash: true,
      nftImageUrl: true,
      investorId: true,
      startupId: true,
      investor: {
        select: { id: true, name: true, email: true, walletAddress: true },
      },
      startup: {
        select: { id: true, name: true, email: true, walletAddress: true },
      },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          title: true,
          status: true,
          amountUSD: true,
          cancelAfter: true,
          evmTxHash: true,
          nftTokenId: true,
          proofs: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              fileName: true,
              aiDecision: true,
              aiConfidence: true,
              aiReasoning: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.investorId !== userId && contract.startupId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { investorId: _i, startupId: _s, ...data } = contract;
  return NextResponse.json(data);
}
