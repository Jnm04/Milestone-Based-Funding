import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
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

  return response;
}

export const config = {
  // Apply to all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
