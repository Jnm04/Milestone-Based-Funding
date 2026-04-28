import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/**
 * GET /api/auth/sso/complete?token=...&callbackUrl=...
 *
 * Serves a minimal HTML page that auto-submits the SSO token to NextAuth's
 * credentials provider. This is the bridge between the OIDC/SAML callback
 * (which runs server-side) and NextAuth's session creation (which requires
 * a browser form POST with a CSRF token).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") ?? "/enterprise/dashboard";

  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_invalid`);
  }

  // Fetch the CSRF token from NextAuth (same-origin server-side call)
  let csrfToken = "";
  try {
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    const csrfData = await csrfRes.json() as { csrfToken?: string };
    csrfToken = csrfData.csrfToken ?? "";
  } catch {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_csrf_error`);
  }

  if (!csrfToken) {
    return NextResponse.redirect(`${BASE_URL}/login?error=sso_csrf_error`);
  }

  const safeCallback = encodeURIComponent(callbackUrl);
  const safeToken = token.replace(/[^0-9a-f]/g, "");
  const safeCsrf = csrfToken.replace(/[^0-9a-zA-Z_-]/g, "");

  // Auto-submitting form — signs in via the sso-token credentials provider
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Signing in…</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; background: #171311; font-family: sans-serif; color: #EDE6DD; }
    p { opacity: .6; font-size: 14px; }
  </style>
</head>
<body>
  <p>Completing sign-in…</p>
  <form id="f" method="POST" action="/api/auth/callback/sso-token">
    <input type="hidden" name="csrfToken" value="${safeCsrf}" />
    <input type="hidden" name="token" value="${safeToken}" />
    <input type="hidden" name="callbackUrl" value="${safeCallback}" />
    <input type="hidden" name="json" value="true" />
  </form>
  <script>document.getElementById("f").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
