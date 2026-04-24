import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { runAttestation } from "@/services/attestation/runner.service";
import { resolveAuth } from "@/lib/api-key-auth";

function currentPeriod(scheduleType: string | null): string {
  const now = new Date();
  if (scheduleType === "MONTHLY") {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (scheduleType === "QUARTERLY") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${q}`;
  }
  if (scheduleType === "ANNUAL") return String(now.getFullYear());
  return now.toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      milestones: {
        where: {
          dataSourceLockedAt: { not: null },
          dataSourceType: { not: "MANUAL_REVIEW" },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.investorId !== auth.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.mode !== "ATTESTATION")
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  if (contract.milestones.length === 0)
    return NextResponse.json({ error: "No runnable milestones — lock at least one data source first" }, { status: 400 });

  const results: { milestoneId: string; title: string; verdict?: string; error?: string }[] = [];

  for (const m of contract.milestones) {
    if (m.dataSourceType === "FILE_UPLOAD" && !m.attestationFetchedAt) {
      results.push({ milestoneId: m.id, title: m.title, error: "No source file uploaded yet" });
      continue;
    }
    if (contract.requiresApproval && m.internalApprovalStatus !== "APPROVED") {
      results.push({ milestoneId: m.id, title: m.title, error: "Awaiting internal approval" });
      continue;
    }
    try {
      const period = currentPeriod(m.scheduleType);
      const result = await runAttestation(m.id, period, "PLATFORM");
      results.push({ milestoneId: m.id, title: m.title, verdict: result.verdict });
    } catch (err) {
      results.push({
        milestoneId: m.id,
        title: m.title,
        error: err instanceof Error ? err.message : "Run failed",
      });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
