import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { runAttestation } from "@/services/attestation/runner.service";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function currentPeriod(scheduleType: string | null): string {
  const now = new Date();
  if (scheduleType === "MONTHLY") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (scheduleType === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  if (scheduleType === "ANNUAL") {
    return String(now.getFullYear());
  }
  return now.toISOString().slice(0, 10); // ONE_OFF: YYYY-MM-DD
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });
  }

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  if (!milestone.dataSourceLockedAt) {
    return NextResponse.json({ error: "Lock the data source before running attestation" }, { status: 409 });
  }

  // Approval gate: if the goal set requires internal approval, the milestone must be approved first
  if (contract.requiresApproval && milestone.internalApprovalStatus !== "APPROVED") {
    return NextResponse.json(
      { error: "This milestone requires internal approval before verification can run" },
      { status: 403 }
    );
  }

  // Rate limit: max 3 manual runs per milestone per hour
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`attestation-run:${milestoneId}:${session.user.id ?? ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attestation runs. Please wait before trying again." }, { status: 429 });
  }

  try {
    const period = currentPeriod(milestone.scheduleType);
    const result = await runAttestation(milestoneId, period, "MANUAL");
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[attestation/run]", err);
    return NextResponse.json({ error: "Attestation run failed" }, { status: 500 });
  }
}
