import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/enterprise/auditor-access
 * Enterprise user grants an auditor (by email) read-only access to their attestations.
 *
 * GET /api/enterprise/auditor-access
 * List all auditors with access to the current user's workspace.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accesses = await prisma.auditorClientAccess.findMany({
    where: { clientId: session.user.id, revokedAt: null },
    include: { auditor: { include: { user: { select: { email: true, name: true } } } } },
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json({ accesses });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const body = await request.json() as { auditorEmail?: string };
  if (!body.auditorEmail) return NextResponse.json({ error: "auditorEmail is required" }, { status: 400 });

  // Find the auditor partner by email
  const auditorUser = await prisma.user.findUnique({
    where: { email: body.auditorEmail.toLowerCase().trim() },
    include: { auditorPartner: true },
  });

  if (!auditorUser?.auditorPartner) {
    return NextResponse.json(
      { error: "No auditor partner account found with that email. The auditor must have a registered cascrow auditor account." },
      { status: 404 }
    );
  }

  const existing = await prisma.auditorClientAccess.findUnique({
    where: { auditorId_clientId: { auditorId: auditorUser.auditorPartner.id, clientId: session.user.id } },
  });

  if (existing && !existing.revokedAt) {
    return NextResponse.json({ error: "This auditor already has access" }, { status: 409 });
  }

  const access = await prisma.auditorClientAccess.upsert({
    where: { auditorId_clientId: { auditorId: auditorUser.auditorPartner.id, clientId: session.user.id } },
    create: {
      auditorId: auditorUser.auditorPartner.id,
      clientId: session.user.id,
    },
    update: {
      revokedAt: null,
      grantedAt: new Date(),
    },
    include: { auditor: { include: { user: { select: { email: true, name: true } } } } },
  });

  return NextResponse.json({ access }, { status: 201 });
}
