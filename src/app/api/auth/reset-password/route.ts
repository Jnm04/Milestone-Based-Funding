import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import zxcvbn from "zxcvbn";
import { isPasswordPwned } from "@/lib/hibp";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`reset-password:${ip}`, 5, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { token, password } = await request.json();

    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (token.length > 128) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (password.length > 72) {
      return NextResponse.json({ error: "Password must be at most 72 characters" }, { status: 400 });
    }

    if (zxcvbn(password).score < 2) {
      return NextResponse.json({ error: "Password is too weak. Use a mix of letters, numbers, and symbols, or a longer passphrase." }, { status: 400 });
    }

    if (await isPasswordPwned(password)) {
      return NextResponse.json({ error: "This password has appeared in a data breach. Please choose a different password." }, { status: 400 });
    }

    // Hash the received token before DB lookup — tokens are stored as SHA-256 hashes.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await prisma.user.findUnique({ where: { passwordResetToken: tokenHash } });

    if (!user || !user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // updateMany with token condition ensures the token can only be consumed once
    // even under concurrent requests (second request finds count === 0)
    const updated = await prisma.user.updateMany({
      where: { id: user.id, passwordResetToken: tokenHash },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
        loginAttempts: 0,
        lockoutUntil: null,
        sessionVersion: { increment: 1 },
        passwordChangedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
