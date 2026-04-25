import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  if (!(await checkRateLimit(`enterprise-pulse:${auth.userId}`, 60, 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const contracts = await prisma.contract.findMany({
    where: { investorId: effectiveUserId, mode: "ATTESTATION" },
    select: {
      id: true,
      milestone: true,
      milestones: {
        select: {
          id: true,
          title: true,
          pulseCheckEnabled: true,
          pulseCheckInterval: true,
          lastPulseCheckRisk: true,
          predictedOutcome: true,
          predictedConfidence: true,
          pulseSnapshots: {
            orderBy: { capturedAt: "desc" },
            take: 8,
            select: {
              id: true,
              capturedAt: true,
              risk: true,
              rawValue: true,
              targetValue: true,
              confidence: true,
            },
          },
        },
      },
    },
  });

  const milestones = contracts.flatMap((c) =>
    c.milestones.map((m) => ({
      ...m,
      snapshots: m.pulseSnapshots,
      pulseSnapshots: undefined,
      contractTitle: c.milestone,
      contractId: c.id,
    }))
  );

  // Sort: LIKELY_MISS first, then AT_RISK, then ON_TRACK, then no data
  const riskOrder: Record<string, number> = { LIKELY_MISS: 0, AT_RISK: 1, ON_TRACK: 2 };
  milestones.sort((a, b) => {
    const ra = riskOrder[a.lastPulseCheckRisk ?? ""] ?? 3;
    const rb = riskOrder[b.lastPulseCheckRisk ?? ""] ?? 3;
    return ra - rb;
  });

  return NextResponse.json({ milestones });
}
