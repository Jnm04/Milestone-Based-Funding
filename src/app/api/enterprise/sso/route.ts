import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ALLOWED_PROVIDERS = ["OKTA", "AZURE_AD", "GOOGLE_WORKSPACE", "SAML"] as const;

const ssoSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  connectionId: z.string().min(1).max(200),
  domain: z.string().min(1).max(253).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format"),
});

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

  const allowed = await checkRateLimit(`sso-save:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = ssoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const emailDomain = session.user.email?.split("@")[1]?.toLowerCase();
  if (!emailDomain) return NextResponse.json({ error: "Account email domain could not be determined" }, { status: 400 });

  const normalised = parsed.data.domain.toLowerCase().trim();
  if (normalised !== emailDomain && !normalised.endsWith("." + emailDomain)) {
    return NextResponse.json(
      { error: `Domain must match your account's email domain (${emailDomain})` },
      { status: 400 }
    );
  }

  const config = await prisma.ssoConfig.upsert({
    where: { orgId: session.user.id },
    create: {
      orgId: session.user.id,
      provider: parsed.data.provider,
      connectionId: parsed.data.connectionId,
      domain: normalised,
    },
    update: {
      provider: parsed.data.provider,
      connectionId: parsed.data.connectionId,
      domain: normalised,
    },
  });

  return NextResponse.json({ config });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const allowed = await checkRateLimit(`sso-delete:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  await prisma.ssoConfig.deleteMany({ where: { orgId: session.user.id } });
  return NextResponse.json({ ok: true });
}
