import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/services/evm/audit.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "INVESTOR") {
      return NextResponse.json({ error: "Investor access required" }, { status: 403 });
    }

    const { contractId, decision } = await request.json();

    if (!contractId || !["APPROVE", "REJECT"].includes(decision)) {
      return NextResponse.json({ error: "contractId and decision (APPROVE|REJECT) required" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { investor: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investor.id !== session.user.id) {
      return NextResponse.json({ error: "Not your contract" }, { status: 403 });
    }

    if (contract.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Contract is not pending review" }, { status: 409 });
    }

    const newStatus = decision === "APPROVE" ? "VERIFIED" : "REJECTED";
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: newStatus },
    });

    // Also update any milestone currently in PENDING_REVIEW
    await prisma.milestone.updateMany({
      where: { contractId, status: "PENDING_REVIEW" },
      data: { status: newStatus as never },
    });

    void writeAuditLog({
      contractId,
      event: decision === "APPROVE" ? "MANUAL_REVIEW_APPROVED" : "MANUAL_REVIEW_REJECTED",
      actor: session.user.id,
    });

    return NextResponse.json({ status: newStatus });
  } catch (err) {
    console.error("Review error:", err);
    return NextResponse.json({ error: "Review failed" }, { status: 500 });
  }
}
