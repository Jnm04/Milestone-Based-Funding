import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/admin-audit";

// POST /api/internal/contracts/[id]/suspend
// body: { suspend: true|false, reason?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isInternalAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { suspend: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { id: true, status: true, investorId: true },
  });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const newStatus = body.suspend ? "SUSPENDED" : contract.status;

  // Contracts don't have a "SUSPENDED" enum value — we use a metadata approach:
  // Store suspension state in a dedicated AuditLog event instead of changing status,
  // so the enum doesn't need migration. Status is left unchanged but an audit record
  // marks the contract as suspended.
  await prisma.auditLog.create({
    data: {
      contractId: id,
      event: body.suspend ? "ADMIN_SUSPENDED" : "ADMIN_UNSUSPENDED",
      actor: "ADMIN",
      metadata: { reason: body.reason ?? null, previousStatus: contract.status },
    },
  });

  await logAdminAction(
    req,
    body.suspend ? "CONTRACT_SUSPENDED" : "CONTRACT_UNSUSPENDED",
    "CONTRACT",
    id,
    { status: contract.status },
    { suspended: body.suspend, reason: body.reason ?? null }
  );

  return NextResponse.json({
    contractId: id,
    suspended: body.suspend,
    message: body.suspend
      ? `Contract ${id} suspended. An ADMIN_SUSPENDED audit event has been logged.`
      : `Contract ${id} suspension lifted.`,
  });
}
