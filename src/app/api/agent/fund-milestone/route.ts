import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { nanoid } from "nanoid";

// Agent-only endpoint: sets a milestone to FUNDED with a simulated tx hash.
// Requires API key auth. Only works for contracts owned by the API key's user.
// If contract is still DRAFT (no startup joined yet), it auto-advances to
// AWAITING_ESCROW first, then immediately to FUNDED — bypassing MetaMask.
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

  // Fetch contract + milestones for ownership check
  const resolvedContractId = contractId ?? (
    await prisma.milestone.findUnique({ where: { id: milestoneId! }, select: { contractId: true } })
  )?.contractId;

  if (!resolvedContractId) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: resolvedContractId },
    include: { milestones: { orderBy: { order: "asc" } } },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (contract.investorId !== apiKeyCtx.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If still DRAFT, auto-advance: set startup = investor (self-funded agent demo),
  // move contract + all milestones to AWAITING_ESCROW
  if (contract.status === "DRAFT") {
    await prisma.$transaction([
      prisma.contract.update({
        where: { id: resolvedContractId },
        data: { status: "AWAITING_ESCROW", startupId: apiKeyCtx.userId },
      }),
      prisma.milestone.updateMany({
        where: { contractId: resolvedContractId },
        data: { status: "AWAITING_ESCROW" },
      }),
    ]);
  }

  // Pick the target milestone
  const target = milestoneId
    ? contract.milestones.find((m) => m.id === milestoneId)
    : contract.milestones.find((m) => ["AWAITING_ESCROW", "PENDING"].includes(m.status));

  if (!target) {
    return NextResponse.json({ error: "No fundable milestone found" }, { status: 409 });
  }

  const fakeTxHash = `0xagent${nanoid(61)}`.slice(0, 66);

  await prisma.$transaction([
    prisma.milestone.update({
      where: { id: target.id },
      data: { status: "FUNDED", evmTxHash: fakeTxHash },
    }),
    prisma.contract.update({
      where: { id: resolvedContractId },
      data: { status: "FUNDED", evmTxHash: fakeTxHash },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    milestoneId: target.id,
    contractId: resolvedContractId,
    txHash: fakeTxHash,
    status: "FUNDED",
  });
}
