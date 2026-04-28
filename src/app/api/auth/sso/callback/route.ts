import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encrypt";
import crypto from "crypto";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET ?? "dev-secret";
const SSO_TOKEN_TTL_MS = 3 * 60 * 1000; // 3 minutes

// ── State verification ────────────────────────────────────────────────────────

function verifyState(raw: string, expectedState: string): boolean {
  const decoded = Buffer.from(raw, "base64url").toString();
  const parts = decoded.split(":");
  if (parts.length < 3) return false;

  const sig = parts.pop()!;
  const payload = parts.join(":");
  const expectedSig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

// ── User upsert after successful SSO ─────────────────────────────────────────

async function upsertSsoUser(email: string, name: string | null): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isEnterprise: true },
  });

  if (existing) {
    // Ensure SSO users from an enterprise domain get isEnterprise=true
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

// ── OIDC token exchange ───────────────────────────────────────────────────────

interface OidcDiscovery {
  token_endpoint: string;
  userinfo_endpoint: string;
}

async function fetchOidcDiscovery(issuerUrl: string): Promise<OidcDiscovery> {
  const url = issuerUrl.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  return res.json() as Promise<OidcDiscovery>;
}

interface UserInfo {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

async function fetchUserInfo(userinfoEndpoint: string, accessToken: string): Promise<UserInfo> {
  const res = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`UserInfo failed: ${res.status}`);
  return res.json() as Promise<UserInfo>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/sso/callback?code=...&state=...
 *
 * Handles the OIDC authorization code callback. Exchanges the code for tokens,
 * fetches user info, upserts the user, creates a short-lived SsoToken, and
 * redirects to NextAuth's sso-token credentials provider to establish a session.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_invalid`);
  }

  // Read and parse cookie
  const cookieHeader = request.cookies.get("sso_state")?.value;
  if (!cookieHeader) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_expired`);
  }

  let cookieData: { state: string; domain: string; callbackUrl: string; codeVerifier: string };
  try {
    cookieData = JSON.parse(decodeURIComponent(cookieHeader));
  } catch {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_invalid`);
  }

  // Verify state
  if (stateParam !== cookieData.state || !verifyState(stateParam, cookieData.state)) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_invalid`);
  }

  const clearCookie = "sso_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

  // Load SSO config for this domain
  const config = await prisma.ssoConfig.findFirst({
    where: { domain: cookieData.domain },
  });

  if (!config?.clientId || !config.clientSecret || !config.issuerUrl) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_misconfigured`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  let discovery: OidcDiscovery;
  try {
    discovery = await fetchOidcDiscovery(config.issuerUrl);
  } catch {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_provider_error`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  // Exchange code for tokens
  const clientSecret = decryptApiKey(config.clientSecret);
  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${BASE_URL}/api/auth/sso/callback`,
      client_id: config.clientId,
      client_secret: clientSecret,
      code_verifier: cookieData.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_token_error`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  const tokens = await tokenRes.json() as { access_token?: string };
  if (!tokens.access_token) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_token_error`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  // Fetch user info from IdP
  let userInfo: UserInfo;
  try {
    userInfo = await fetchUserInfo(discovery.userinfo_endpoint, tokens.access_token);
  } catch {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_userinfo_error`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  if (!userInfo.email) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_no_email`, {
      headers: { "Set-Cookie": clearCookie },
    });
  }

  const name = userInfo.name ?? ([userInfo.given_name, userInfo.family_name].filter(Boolean).join(" ") || null);

  // Upsert user and create one-time token
  const userId = await upsertSsoUser(userInfo.email, name);
  const ssoToken = await createSsoToken(userId);

  // Redirect to NextAuth sso-token provider — it establishes the full session
  const nextAuthUrl = new URL(`${BASE_URL}/api/auth/callback/sso-token`);
  nextAuthUrl.searchParams.set("token", ssoToken);
  nextAuthUrl.searchParams.set("callbackUrl", cookieData.callbackUrl);

  // NextAuth credentials callback expects a POST with csrfToken — use a GET
  // redirect to /api/auth/signin/sso-token which triggers the sign-in form
  const signinUrl = new URL(`${BASE_URL}/api/auth/signin/sso-token`);

  // Use a redirect to a tiny page that auto-submits the credentials form
  const redirectUrl = new URL(`${BASE_URL}/api/auth/sso/complete`);
  redirectUrl.searchParams.set("token", ssoToken);
  redirectUrl.searchParams.set("callbackUrl", cookieData.callbackUrl);

  return NextResponse.redirect(redirectUrl.toString(), {
    headers: { "Set-Cookie": clearCookie },
  });
}
