import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`email-change-confirm:${ip}`, 10, 60 * 60 * 1000))) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=too_many_requests", req.url));
  }

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: tokenHash },
    select: { id: true, pendingEmail: true, emailChangeTokenExpiry: true },
  });

  if (!user || !user.pendingEmail) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));
  }
  if (!user.emailChangeTokenExpiry || user.emailChangeTokenExpiry < new Date()) {
    await prisma.user.updateMany({
      where: { id: user.id, emailChangeToken: tokenHash },
      data: { pendingEmail: null, emailChangeToken: null, emailChangeTokenExpiry: null },
    });
    return NextResponse.redirect(new URL("/profile?emailChangeError=expired", req.url));
  }

  // Final check: new email still available — return generic error to avoid confirming whether an email is registered
  const taken = await prisma.user.findUnique({ where: { email: user.pendingEmail }, select: { id: true } });
  if (taken) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));
  }

  // Atomic update — token in WHERE prevents double-consumption under concurrent requests
  const updated = await prisma.user.updateMany({
    where: { id: user.id, emailChangeToken: tokenHash },
    data: {
      email: user.pendingEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeTokenExpiry: null,
      sessionVersion: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));
  }

  return NextResponse.redirect(new URL("/login?emailChanged=1", req.url));
}
