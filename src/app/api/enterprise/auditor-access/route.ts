import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/enterprise/auditor-access
 * Enterprise user grants an auditor (by email) read-only access to their attestations.
 *
 * GET /api/enterprise/auditor-access
 * List all auditors with access to the current user's workspace.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accesses = await prisma.auditorClientAccess.findMany({
    where: { clientId: auth.userId, revokedAt: null },
    include: { auditor: { include: { user: { select: { email: true, name: true } } } } },
    orderBy: { grantedAt: "desc" },
  });

  return NextResponse.json({ accesses });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

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
    where: { auditorId_clientId: { auditorId: auditorUser.auditorPartner.id, clientId: auth.userId } },
  });

  if (existing && !existing.revokedAt) {
    return NextResponse.json({ error: "This auditor already has access" }, { status: 409 });
  }

  const access = await prisma.auditorClientAccess.upsert({
    where: { auditorId_clientId: { auditorId: auditorUser.auditorPartner.id, clientId: auth.userId } },
    create: {
      auditorId: auditorUser.auditorPartner.id,
      clientId: auth.userId,
    },
    update: {
      revokedAt: null,
      grantedAt: new Date(),
    },
    include: { auditor: { include: { user: { select: { email: true, name: true } } } } },
  });

  return NextResponse.json({ access }, { status: 201 });
}
