import { NextRequest, NextResponse } from "next/server";

// Sources that must be reachable from the browser at runtime.
// All XRPL + EVM server calls happen server-side; only MetaMask's injected provider
// (a browser extension, which bypasses CSP) talks to the EVM RPC directly.
// We still list the RPC URL so any fallback ethers.js provider works correctly.
const CSP = [
  // Default: only same-origin unless overridden below
  "default-src 'self'",

  // Next.js App Router requires 'unsafe-inline' for its hydration scripts.
  // 'unsafe-eval' is included for Three.js shader compilation (react-three-fiber).
  // No external script sources are whitelisted — all JS is self-hosted.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

  // Tailwind generates inline styles; styled components and Three.js do too.
  "style-src 'self' 'unsafe-inline'",

  // Browser-side network requests: own API + XRPL EVM RPC (MetaMask fallback provider).
  // Both WS and HTTPS variants are included because ethers.js uses WebSocket subscriptions.
  "connect-src 'self' https://rpc.testnet.xrplevm.org wss://rpc.testnet.xrplevm.org",

  // Images from Vercel Blob, inline SVGs (data:), and canvas/Three.js blobs.
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com",

  // Fonts are self-hosted; data: covers any embedded font-face declarations.
  "font-src 'self' data:",

  // Web Workers (Three.js / postprocessing may spawn them).
  "worker-src 'self' blob:",

  // No <object>, <embed>, or <applet> — eliminates entire plugin attack surface.
  "object-src 'none'",

  // Prevent <base href> injection attacks that redirect relative URLs.
  "base-uri 'self'",

  // Belt-and-suspenders alongside X-Frame-Options: DENY.
  "frame-ancestors 'none'",
].join("; ");

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

  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Stop referrer leaking sensitive paths
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Disable browser features we don't use
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Force HTTPS for 1 year + preload list eligibility
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Isolate browsing context from cross-origin windows
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // Content Security Policy — restricts what the browser can load and where it can connect
  response.headers.set("Content-Security-Policy", CSP);

  return response;
}

export const config = {
  // Apply to all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
