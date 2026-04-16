import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      investorId: true,
      startupId: true,
      status: true,
      milestones: { select: { id: true, status: true }, orderBy: { order: "asc" } },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.investorId !== session.user.id && contract.startupId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { investorId: _i, startupId: _s, ...contractData } = contract;
  return NextResponse.json(contractData);
}

const patchContractSchema = z.object({
  milestone: z.string().min(1).max(200).trim().optional(),
  amountUSD: z.coerce.number().positive().max(999_999_999).optional(),
  cancelAfter: z
    .string()
    .refine((v) => !isNaN(new Date(v).getTime()), { message: "cancelAfter must be a valid date" })
    .refine((v) => new Date(v) > new Date(), { message: "Deadline must be in the future" })
    .optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, startupId: true, status: true },
  });

  if (!contract) {
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

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      ...(milestone !== undefined ? { milestone } : {}),
      ...(amountUSD !== undefined ? { amountUSD } : {}),
      ...(cancelAfter !== undefined ? { cancelAfter: new Date(cancelAfter) } : {}),
    },
  });

  return NextResponse.json({ ok: true, contract: updated });
}
