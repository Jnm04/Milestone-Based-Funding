import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getEnterpriseContext } from "@/lib/enterprise-context";

type Params = { params: Promise<{ id: string; milestoneId: string }> };

// POST /api/enterprise/attestations/[id]/milestones/[milestoneId]/approve
// Body: { action: "APPROVED" | "REJECTED", note?: string }
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, milestoneId } = await params;
  const body = await req.json().catch(() => null) as { action?: string; note?: string } | null;

  if (body?.action !== "APPROVED" && body?.action !== "REJECTED") {
    return NextResponse.json({ error: "action must be APPROVED or REJECTED" }, { status: 400 });
  }

  const { effectiveUserId, role } = await getEnterpriseContext(session.user.id);

  // Only OWNER or EDITOR can approve/reject
  if (role === "VIEWER") return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, mode: true, requiresApproval: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.investorId !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.mode !== "ATTESTATION") return NextResponse.json({ error: "Not an attestation" }, { status: 400 });
  if (!contract.requiresApproval) return NextResponse.json({ error: "Approval workflow not enabled for this goal set" }, { status: 400 });

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: { contractId: true },
  });
  if (!milestone || milestone.contractId !== id) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const approverName = session.user.name ?? session.user.email ?? "Team member";

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      internalApprovalStatus: body.action,
      internalApprovedBy: approverName,
      internalApprovedAt: new Date(),
      internalApprovalNote: body.note?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, status: body.action });
}
