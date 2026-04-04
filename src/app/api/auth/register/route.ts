import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: "email, password and role are required" }, { status: 400 });
    }

    if (!["INVESTOR", "STARTUP"].includes(role)) {
      return NextResponse.json({ error: "role must be INVESTOR or STARTUP" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        role,
        emailVerified: true,
        emailVerificationToken,
        emailVerificationTokenExpiry,
      },
    });

    // Send verification email (non-blocking — registration succeeds even if mail fails)
    sendVerificationEmail({ to: email, token: emailVerificationToken }).catch((err) =>
      console.error("[register] Failed to send verification email:", err)
    );

    return NextResponse.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
