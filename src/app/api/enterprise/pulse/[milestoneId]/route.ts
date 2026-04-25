import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { getEnterpriseContext } from "@/lib/enterprise-context";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { milestoneId } = await params;
  const body = await req.json().catch(() => null) as {
    pulseCheckEnabled?: boolean;
    pulseCheckInterval?: string;
  } | null;

  if (!body || typeof body.pulseCheckEnabled !== "boolean") {
    return NextResponse.json({ error: "pulseCheckEnabled (boolean) is required" }, { status: 400 });
  }

  const VALID_INTERVALS = ["WEEKLY", "BIWEEKLY", "MID_PERIOD"];
  if (body.pulseCheckInterval && !VALID_INTERVALS.includes(body.pulseCheckInterval)) {
    return NextResponse.json({ error: "Invalid pulseCheckInterval" }, { status: 400 });
  }

  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { investorId: true, mode: true } } },
  });

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (milestone.contract.investorId !== effectiveUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (milestone.contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation milestone" }, { status: 400 });
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      pulseCheckEnabled: body.pulseCheckEnabled,
      ...(body.pulseCheckInterval !== undefined && { pulseCheckInterval: body.pulseCheckInterval }),
    },
  });

  return NextResponse.json({ ok: true });
}
