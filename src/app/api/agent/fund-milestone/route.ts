import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { nanoid } from "nanoid";

// Agent-only endpoint: sets a milestone to FUNDED with a simulated tx hash.
// Requires API key auth. Only works for contracts owned by the API key's user.
// This allows agent demos to bypass MetaMask while the normal browser escrow
// flow (MetaMask → EVM) remains unchanged.
export async function POST(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "Unauthorized — API key required" }, { status: 401 });
  }

  let body: { milestoneId?: string; contractId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { milestoneId, contractId } = body;
  if (!milestoneId && !contractId) {
    return NextResponse.json({ error: "milestoneId or contractId is required" }, { status: 400 });
  }

  // Fetch milestone with contract for ownership check
  const milestone = milestoneId
    ? await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { contract: { select: { id: true, investorId: true } } },
      })
    : await prisma.milestone.findFirst({
        where: { contractId: contractId!, status: "AWAITING_ESCROW" },
        include: { contract: { select: { id: true, investorId: true } } },
        orderBy: { order: "asc" },
      });

  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found or not in AWAITING_ESCROW status" }, { status: 404 });
  }

  // Only the contract owner (investor) may fund via API key
  if (milestone.contract.investorId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (milestone.status !== "AWAITING_ESCROW") {
    return NextResponse.json(
      { error: `Expected AWAITING_ESCROW, got ${milestone.status}` },
      { status: 409 }
    );
  }

  const fakeTxHash = `0xagent${nanoid(61)}`.slice(0, 66);

  await prisma.$transaction([
    prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: "FUNDED", evmTxHash: fakeTxHash },
    }),
    prisma.contract.update({
      where: { id: milestone.contractId },
      data: { status: "FUNDED", evmTxHash: fakeTxHash },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    milestoneId: milestone.id,
    contractId: milestone.contractId,
    txHash: fakeTxHash,
    status: "FUNDED",
  });
}
