import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { encryptApiKey } from "@/lib/encrypt";
import { z } from "zod";
import { writeOrgAuditLog } from "@/lib/org-audit";

const ALLOWED_PROVIDERS = ["OKTA", "AZURE_AD", "GOOGLE_WORKSPACE", "SAML"] as const;
const OIDC_PROVIDERS = ["OKTA", "AZURE_AD", "GOOGLE_WORKSPACE"] as const;

const ssoSchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS),
  connectionId: z.string().max(200).optional().default(""),
  domain: z.string().min(1).max(253).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format"),
  // OIDC fields
  clientId: z.string().min(1).max(300).optional(),
  clientSecret: z.string().min(1).max(500).optional(),
  issuerUrl: z.string().url().max(500).optional(),
  // SAML fields
  samlSsoUrl: z.string().url().max(500).optional(),
  samlCertificate: z.string().max(10000).optional(),
  samlEntityId: z.string().max(500).optional(),
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

  if (!config) return NextResponse.json({ config: null });

  return NextResponse.json({
    config: {
      id: config.id,
      provider: config.provider,
      connectionId: config.connectionId,
      domain: config.domain,
      clientId: config.clientId ?? null,
      clientSecretSet: !!config.clientSecret,
      issuerUrl: config.issuerUrl ?? null,
      samlSsoUrl: config.samlSsoUrl ?? null,
      samlCertificateSet: !!config.samlCertificate,
      samlEntityId: config.samlEntityId ?? null,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    },
  });
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

  const isOidc = (OIDC_PROVIDERS as readonly string[]).includes(parsed.data.provider);

  // Validate: OIDC providers need clientId + issuerUrl
  if (isOidc && (!parsed.data.clientId || !parsed.data.issuerUrl)) {
    return NextResponse.json(
      { error: "Client ID and Issuer URL are required for this provider" },
      { status: 400 }
    );
  }
  // Validate: SAML needs samlSsoUrl + samlCertificate on first save
  const existing = await prisma.ssoConfig.findUnique({ where: { orgId: session.user.id } });
  if (parsed.data.provider === "SAML" && !parsed.data.samlSsoUrl && !existing?.samlSsoUrl) {
    return NextResponse.json({ error: "SSO URL is required for SAML" }, { status: 400 });
  }
  if (parsed.data.provider === "SAML" && !parsed.data.samlCertificate && !existing?.samlCertificate) {
    return NextResponse.json({ error: "Certificate is required for SAML" }, { status: 400 });
  }

  // Encrypt new secrets; preserve existing when blank (user didn't change them)
  let encryptedClientSecret: string | null = existing?.clientSecret ?? null;
  if (parsed.data.clientSecret) {
    encryptedClientSecret = encryptApiKey(parsed.data.clientSecret);
  }

  let encryptedSamlCert: string | null = existing?.samlCertificate ?? null;
  if (parsed.data.samlCertificate) {
    encryptedSamlCert = encryptApiKey(parsed.data.samlCertificate);
  }

  const config = await prisma.ssoConfig.upsert({
    where: { orgId: session.user.id },
    create: {
      orgId: session.user.id,
      provider: parsed.data.provider,
      connectionId: parsed.data.connectionId ?? "",
      domain: normalised,
      clientId: isOidc ? (parsed.data.clientId ?? null) : null,
      clientSecret: isOidc ? encryptedClientSecret : null,
      issuerUrl: isOidc ? (parsed.data.issuerUrl ?? null) : null,
      samlSsoUrl: parsed.data.provider === "SAML" ? (parsed.data.samlSsoUrl ?? null) : null,
      samlCertificate: parsed.data.provider === "SAML" ? encryptedSamlCert : null,
      samlEntityId: parsed.data.provider === "SAML" ? (parsed.data.samlEntityId ?? null) : null,
    },
    update: {
      provider: parsed.data.provider,
      connectionId: parsed.data.connectionId ?? "",
      domain: normalised,
      clientId: isOidc ? (parsed.data.clientId ?? null) : null,
      clientSecret: isOidc ? encryptedClientSecret : null,
      issuerUrl: isOidc ? (parsed.data.issuerUrl ?? null) : null,
      samlSsoUrl: parsed.data.provider === "SAML" ? (parsed.data.samlSsoUrl ?? null) : null,
      samlCertificate: parsed.data.provider === "SAML" ? encryptedSamlCert : null,
      samlEntityId: parsed.data.provider === "SAML" ? (parsed.data.samlEntityId ?? null) : null,
    },
  });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "SSO_CONFIGURED",
    detail: `SSO configured with ${parsed.data.provider} for domain ${normalised}`,
    meta: { provider: parsed.data.provider, domain: normalised },
  });

  return NextResponse.json({
    config: {
      id: config.id,
      provider: config.provider,
      domain: config.domain,
      clientId: config.clientId ?? null,
      clientSecretSet: !!config.clientSecret,
      issuerUrl: config.issuerUrl ?? null,
      samlSsoUrl: config.samlSsoUrl ?? null,
      samlCertificateSet: !!config.samlCertificate,
      samlEntityId: config.samlEntityId ?? null,
    },
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const allowed = await checkRateLimit(`sso-delete:${session.user.id}`, 5, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  await prisma.ssoConfig.deleteMany({ where: { orgId: session.user.id } });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "SSO_REMOVED",
    detail: "SSO configuration removed",
  });

  return NextResponse.json({ ok: true });
}
