import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/enterprise/sso — get SSO config for the current user's org
 * POST /api/enterprise/sso — save/update SSO config
 * DELETE /api/enterprise/sso — remove SSO config (revert to password auth)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const config = await prisma.ssoConfig.findUnique({
    where: { orgId: session.user.id },
  });

  return NextResponse.json({ config });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const body = await request.json() as {
    provider?: string;
    connectionId?: string;
    domain?: string;
  };

  if (!body.provider || !body.connectionId || !body.domain) {
    return NextResponse.json({ error: "provider, connectionId, and domain are required" }, { status: 400 });
  }

  const emailDomain = session.user.email?.split("@")[1] ?? "";
  if (body.domain !== emailDomain && !body.domain.endsWith("." + emailDomain)) {
    return NextResponse.json(
      { error: `Domain must match your account's email domain (${emailDomain})` },
      { status: 400 }
    );
  }

  const config = await prisma.ssoConfig.upsert({
    where: { orgId: session.user.id },
    create: {
      orgId: session.user.id,
      provider: body.provider,
      connectionId: body.connectionId,
      domain: body.domain.toLowerCase().trim(),
    },
    update: {
      provider: body.provider,
      connectionId: body.connectionId,
      domain: body.domain.toLowerCase().trim(),
    },
  });

  return NextResponse.json({ config });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  await prisma.ssoConfig.deleteMany({ where: { orgId: session.user.id } });
  return NextResponse.json({ ok: true });
}
