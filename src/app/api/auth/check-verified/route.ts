import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/auth/check-verified?email=...
 *
 * Public endpoint — no session required.
 * Used by the signup flow to poll whether the user has clicked the verification link.
 * Rate-limited by IP to prevent email enumeration abuse.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email || email.length > 254) {
    return NextResponse.json({ verified: false });
  }

  // Rate-limit by IP: 20 checks per minute is plenty for a polling loop
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`check-verified:${ip}`, 20, 60_000))) {
    return NextResponse.json({ verified: false }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { emailVerified: true },
  });

  return NextResponse.json({ verified: user?.emailVerified ?? false });
}
