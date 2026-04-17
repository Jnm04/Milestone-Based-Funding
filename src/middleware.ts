import { NextRequest, NextResponse } from "next/server";

// Allowed origins for cross-origin API requests (browser CSRF protection).
// Server-to-server callers (cron, webhooks, CLI) don't send Origin — those pass through.
const ALLOWED_ORIGINS = new Set([
  "https://cascrow.com",
  "https://www.cascrow.com",
  "http://localhost:3000",
  "http://localhost:3001",
]);

export function middleware(request: NextRequest) {
  // CSRF: reject cross-origin browser requests to mutating API endpoints.
  // Origin is only set by browsers; server-to-server calls have no Origin → allowed.
  // NextAuth routes (/api/auth/*) have their own built-in CSRF protection.
  const { method, nextUrl } = request;
  if (
    ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
    nextUrl.pathname.startsWith("/api/") &&
    !nextUrl.pathname.startsWith("/api/auth/")
  ) {
    const origin = request.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Security headers are set statically via next.config.ts headers().
  // Middleware only handles dynamic per-request logic (CSRF above).
  return NextResponse.next();
}

export const config = {
  // Apply to all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
