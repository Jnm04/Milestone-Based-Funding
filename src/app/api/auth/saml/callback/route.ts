import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encrypt";
import crypto from "crypto";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET ?? "dev-secret";
const SSO_TOKEN_TTL_MS = 3 * 60 * 1000; // 3 minutes

// ── State verification ────────────────────────────────────────────────────────

function verifyState(raw: string): string | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length < 3) return null;

    const sig = parts.pop()!;
    const payload = parts.join(":");
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(payload)
      .digest("hex")
      .slice(0, 16);

    const match = crypto.timingSafeEqual(
      Buffer.from(sig.padEnd(32, "0")),
      Buffer.from(expectedSig.padEnd(32, "0"))
    );
    if (!match) return null;

    // payload = "domain:timestamp"
    const [domain] = payload.split(":");
    return domain ?? null;
  } catch {
    return null;
  }
}

// ── User upsert ───────────────────────────────────────────────────────────────

async function upsertSsoUser(email: string, name: string | null): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isEnterprise: true },
  });

  if (existing) {
    if (!existing.isEnterprise) {
      await prisma.user.update({ where: { id: existing.id }, data: { isEnterprise: true } });
    }
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash: null,
      role: "INVESTOR",
      emailVerified: true,
      isEnterprise: true,
    },
    select: { id: true },
  });
  return user.id;
}

// ── One-time SSO token ────────────────────────────────────────────────────────

async function createSsoToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.ssoToken.upsert({
    where: { userId },
    create: { userId, token, expiresAt: new Date(Date.now() + SSO_TOKEN_TTL_MS) },
    update: { token, expiresAt: new Date(Date.now() + SSO_TOKEN_TTL_MS) },
  });
  return token;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/saml/callback
 *
 * SAML 2.0 Assertion Consumer Service (ACS) endpoint.
 * Receives SAMLResponse from the IdP, validates it using node-saml,
 * extracts user attributes, upserts the user, and redirects to the
 * SSO completion page.
 */
export async function POST(request: NextRequest) {
  const clearCookie = "sso_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

  let body: URLSearchParams;
  try {
    const text = await request.text();
    body = new URLSearchParams(text);
  } catch {
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_invalid`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  const samlResponse = body.get("SAMLResponse");
  const relayState = body.get("RelayState") ?? "";

  if (!samlResponse) {
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_missing_response`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  // Verify relay state (state cookie not required for SAML — IdP posts directly)
  const domain = verifyState(relayState);
  if (!domain) {
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_invalid_state`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  // Load SAML config for this domain
  const config = await prisma.ssoConfig.findFirst({
    where: { domain, provider: "SAML" },
  });

  if (!config?.samlSsoUrl || !config.samlCertificate) {
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_misconfigured`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  const cert = decryptApiKey(config.samlCertificate);

  // Validate the SAML response using node-saml
  type SamlProfile = { nameID?: string; email?: string; displayName?: string; firstName?: string; lastName?: string };
  let profile: SamlProfile | null = null;

  try {
    const { SAML } = await import("node-saml");
    const saml = new SAML({
      entryPoint: config.samlSsoUrl,
      issuer: config.samlEntityId ?? "https://cascrow.com",
      callbackUrl: `${BASE_URL}/api/auth/saml/callback`,
      idpCert: cert,
      wantAssertionsSigned: true,
      disableRequestedAuthnContext: true,
    });

    const result = await saml.validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile as SamlProfile | null;
  } catch (err) {
    console.error("[saml/callback] validation failed:", err);
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_validation_failed`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  // Extract email — SAML assertions vary by IdP
  const email = (
    profile?.email ??
    profile?.nameID
  )?.toLowerCase().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(`${BASE_URL}/login?error=saml_no_email`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  const name =
    profile?.displayName ??
    ([profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || null);

  const userId = await upsertSsoUser(email, name);
  const ssoToken = await createSsoToken(userId);

  const completeUrl = new URL(`${BASE_URL}/api/auth/sso/complete`);
  completeUrl.searchParams.set("token", ssoToken);
  completeUrl.searchParams.set("callbackUrl", "/enterprise/dashboard");

  return NextResponse.redirect(completeUrl.toString(), {
    headers: { "Set-Cookie": clearCookie },
  });
}
