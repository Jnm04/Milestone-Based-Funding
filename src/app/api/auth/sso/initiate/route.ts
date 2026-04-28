import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { decryptApiKey } from "@/lib/encrypt";
import crypto from "crypto";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SECRET = process.env.NEXTAUTH_SECRET ?? "dev-secret";
const OIDC_PROVIDERS = new Set(["OKTA", "AZURE_AD", "GOOGLE_WORKSPACE"]);

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64url(crypto.randomBytes(48));
}

function generateCodeChallenge(verifier: string): string {
  return base64url(crypto.createHash("sha256").update(verifier).digest());
}

// ── State signing ─────────────────────────────────────────────────────────────

function signState(domain: string): string {
  const payload = `${domain}:${Date.now()}`;
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

// ── OIDC discovery ────────────────────────────────────────────────────────────

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
}

async function fetchOidcDiscovery(issuerUrl: string): Promise<OidcDiscovery> {
  const url = issuerUrl.replace(/\/$/, "") + "/.well-known/openid-configuration";
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`OIDC discovery failed for ${issuerUrl}: ${res.status}`);
  return res.json() as Promise<OidcDiscovery>;
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/sso/initiate?email=user@company.com[&callbackUrl=...]
 *
 * Initiates SSO login. For OIDC providers redirects to the IdP authorization
 * endpoint with PKCE. For SAML redirects to the IdP SSO URL with a deflate-
 * compressed SAMLRequest.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`sso-initiate:${ip}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/enterprise/dashboard";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const domain = email.split("@")[1]!;

  const config = await prisma.ssoConfig.findFirst({
    where: { domain },
  });

  if (!config) {
    return NextResponse.json({ error: "No SSO configured for this domain" }, { status: 404 });
  }

  const state = signState(domain);
  const statePayload = JSON.stringify({ state, domain, callbackUrl });

  const cookieOpts = [
    `sso_state=${encodeURIComponent(statePayload)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    ...(BASE_URL.startsWith("https") ? ["Secure"] : []),
  ].join("; ");

  // ── SAML flow ──────────────────────────────────────────────────────────────
  if (config.provider === "SAML") {
    if (!config.samlSsoUrl) {
      return NextResponse.json({ error: "SAML not fully configured" }, { status: 400 });
    }

    const { SAML } = await import("node-saml");
    const spEntityId = "https://cascrow.com";
    const acsUrl = `${BASE_URL}/api/auth/saml/callback`;

    const saml = new SAML({
      entryPoint: config.samlSsoUrl,
      issuer: spEntityId,
      callbackUrl: acsUrl,
      idpCert: "placeholder", // Not needed for request generation
      wantAssertionsSigned: true,
    });

    const authorizeUrl = await saml.getAuthorizeUrl({ RelayState: state });

    return NextResponse.redirect(authorizeUrl, {
      headers: { "Set-Cookie": cookieOpts },
    });
  }

  // ── OIDC flow ──────────────────────────────────────────────────────────────
  if (!OIDC_PROVIDERS.has(config.provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  if (!config.clientId || !config.issuerUrl) {
    return NextResponse.json({ error: "OIDC not fully configured" }, { status: 400 });
  }

  let discovery: OidcDiscovery;
  try {
    discovery = await fetchOidcDiscovery(config.issuerUrl);
  } catch {
    return NextResponse.json({ error: "Failed to contact identity provider" }, { status: 502 });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store both state + code_verifier in the cookie
  const pkcePayload = JSON.stringify({ state, domain, callbackUrl, codeVerifier });
  const pkceCookieOpts = [
    `sso_state=${encodeURIComponent(pkcePayload)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    ...(BASE_URL.startsWith("https") ? ["Secure"] : []),
  ].join("; ");

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", `${BASE_URL}/api/auth/sso/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authUrl.toString(), {
    headers: { "Set-Cookie": pkceCookieOpts },
  });
}
