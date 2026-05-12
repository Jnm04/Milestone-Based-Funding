import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/services/evm/audit.service";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getMobileSession(req);
  const apiKeyCtx = !session ? await resolveApiKey(req.headers.get("authorization")) : null;
  const userId = session?.user?.id ?? apiKeyCtx?.userId ?? null;

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [contract, auditCount] = await Promise.all([
    prisma.contract.findUnique({
      where: { id },
      select: {
        investorId: true,
        startupId: true,
        status: true,
        nftTokenId: true,
        milestones: { select: { id: true, status: true, nftTokenId: true }, orderBy: { order: "asc" } },
      },
    }),
    prisma.auditLog.count({ where: { contractId: id } }),
  ]);

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.investorId !== userId && contract.startupId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { investorId: _i, startupId: _s, ...contractData } = contract;
  return NextResponse.json({ ...contractData, auditLogs: Array(auditCount) });
}

const patchContractSchema = z.object({
  milestone: z.string().min(1).max(200).trim().optional(),
  amountUSD: z.coerce.number().positive().max(999_999_999).optional(),
  cancelAfter: z
    .string()
    .refine((v) => !isNaN(new Date(v).getTime()), { message: "cancelAfter must be a valid date" })
    .refine((v) => new Date(v) > new Date(Date.now() + 24 * 60 * 60 * 1000), {
      message: "Deadline must be at least 24 hours in the future",
    })
    .refine((v) => new Date(v) < new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000), {
      message: "Deadline cannot be more than 5 years in the future",
    })
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  // Rate limit: 30 edits per contract per hour
  if (!(await checkRateLimit(`edit-contract:${session.user.id}:${id}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many edits. Please wait before trying again.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, startupId: true, status: true, deletedAt: true, milestone: true, amountUSD: true, cancelAfter: true },
  });

  if (!contract || contract.deletedAt) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  // Only the investor who created the contract may edit it
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  // Only DRAFT contracts can be edited (startup hasn't joined yet)
  if (contract.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Contract can only be edited while in DRAFT status", code: "WRONG_STATUS" },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = patchContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const { milestone, amountUSD, cancelAfter } = parsed.data;
  if (!milestone && amountUSD === undefined && !cancelAfter) {
    return NextResponse.json(
      { error: "At least one field (milestone, amountUSD, cancelAfter) must be provided", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  let updated;
  try {
    // Atomic: the `status: "DRAFT"` in WHERE prevents a race where a concurrent join
    // transitions the contract to AWAITING_ESCROW between our read and this write.
    updated = await prisma.contract.update({
      where: { id, status: "DRAFT" },
      data: {
        ...(milestone !== undefined ? { milestone } : {}),
        ...(amountUSD !== undefined ? { amountUSD } : {}),
        ...(cancelAfter !== undefined ? { cancelAfter: new Date(cancelAfter) } : {}),
      },
      select: { id: true, milestone: true, amountUSD: true, cancelAfter: true, updatedAt: true, status: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json(
        { error: "Contract is no longer in DRAFT status and cannot be edited", code: "WRONG_STATUS" },
        { status: 409 }
      );
    }
    throw err;
  }

  // Audit trail — record before/after so terms cannot be silently changed
  void writeAuditLog({
    contractId: id,
    event: "CONTRACT_EDITED",
    actor: session.user.id,
    metadata: {
      before: {
        milestone: contract.milestone,
        amountUSD: contract.amountUSD?.toString(),
        cancelAfter: contract.cancelAfter?.toISOString(),
      },
      after: {
        milestone: milestone ?? contract.milestone,
        amountUSD: amountUSD?.toString() ?? contract.amountUSD?.toString(),
        cancelAfter: cancelAfter ?? contract.cancelAfter?.toISOString(),
      },
    },
  }).catch((err) => console.warn("[patch-contract] audit log failed:", err));

  return NextResponse.json({ ok: true, contract: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, status: true, deletedAt: true },
  });

  if (!contract || contract.deletedAt) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const deletableStatuses = ["DRAFT", "EXPIRED", "DECLINED", "COMPLETED", "REJECTED"];
  if (!deletableStatuses.includes(contract.status)) {
    return NextResponse.json(
      { error: "Only contracts that are not actively funded can be deleted", code: "WRONG_STATUS" },
      { status: 409 }
    );
  }

  await prisma.contract.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
