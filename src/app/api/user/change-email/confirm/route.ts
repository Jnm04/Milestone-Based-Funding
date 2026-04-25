import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));

  const user = await prisma.user.findUnique({
    where: { emailChangeToken: token },
    select: { id: true, pendingEmail: true, emailChangeTokenExpiry: true },
  });

  if (!user || !user.pendingEmail) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=invalid", req.url));
  }
  if (!user.emailChangeTokenExpiry || user.emailChangeTokenExpiry < new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: null, emailChangeToken: null, emailChangeTokenExpiry: null },
    });
    return NextResponse.redirect(new URL("/profile?emailChangeError=expired", req.url));
  }

  // Final check: new email still available
  const taken = await prisma.user.findUnique({ where: { email: user.pendingEmail }, select: { id: true } });
  if (taken) {
    return NextResponse.redirect(new URL("/profile?emailChangeError=taken", req.url));
  }

  // Apply change and invalidate all sessions
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail,
      pendingEmail: null,
      emailChangeToken: null,
      emailChangeTokenExpiry: null,
      sessionVersion: { increment: 1 },
    },
  });

  return NextResponse.redirect(new URL("/login?emailChanged=1", req.url));
}
