import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const PROVIDER_LABELS: Record<string, string> = {
  OKTA: "Okta",
  AZURE_AD: "Microsoft Entra ID",
  GOOGLE_WORKSPACE: "Google Workspace",
  SAML: "SSO",
};

/**
 * GET /api/auth/sso/check?email=user@company.com
 *
 * Public endpoint — checks whether a given email domain has SSO configured.
 * Returns { ssoRequired, provider, providerLabel } without exposing secrets.
 * Rate-limited to 20 req/min per IP.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`sso-check:${ip}`, 20, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ssoRequired: false, provider: null, providerLabel: null });
  }

  const domain = email.split("@")[1];
  if (!domain) return NextResponse.json({ ssoRequired: false, provider: null, providerLabel: null });

  const config = await prisma.ssoConfig.findFirst({
    where: {
      domain,
      OR: [
        { clientId: { not: null } },
        { samlSsoUrl: { not: null } },
      ],
    },
    select: { provider: true },
  });

  if (!config) {
    return NextResponse.json({ ssoRequired: false, provider: null, providerLabel: null });
  }

  return NextResponse.json({
    ssoRequired: true,
    provider: config.provider,
    providerLabel: PROVIDER_LABELS[config.provider] ?? "SSO",
  });
}
