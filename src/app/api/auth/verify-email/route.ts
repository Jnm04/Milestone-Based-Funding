import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: tokenHash },
    });

    if (!user) {
      return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
    }

    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      return NextResponse.redirect(`${BASE_URL}/login?error=token_expired`);
    }

    const updated = await prisma.user.updateMany({
      where: { id: user.id, emailVerificationToken: tokenHash },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
      },
    });

    if (updated.count === 0) {
      return NextResponse.redirect(`${BASE_URL}/login?error=invalid_token`);
    }

    return NextResponse.redirect(`${BASE_URL}/login?verified=1`);
  } catch (err) {
    console.error("[verify-email] Failed:", err);
    return NextResponse.redirect(`${BASE_URL}/login?error=server_error`);
  }
}
