import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
  }

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
  }

  if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
    return NextResponse.redirect(`${BASE_URL}/login?error=token_expired`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
    },
  });

  return NextResponse.redirect(`${BASE_URL}/login?verified=1`);
}
