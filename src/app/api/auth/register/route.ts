import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { screenName } from "@/services/sanctions/sanctions.service";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: "email, password and role are required" }, { status: 400 });
    }

    // Reject oversized inputs
    if (typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length > 72) {
      return NextResponse.json({ error: "Password must be at most 72 characters" }, { status: 400 });
    }
    if (typeof name === "string" && name.length > 200) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (!["INVESTOR", "STARTUP"].includes(role)) {
      return NextResponse.json({ error: "role must be INVESTOR or STARTUP" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // If account exists but is unverified, resend the verification email
      if (!existing.emailVerified) {
        const emailVerificationToken = crypto.randomBytes(32).toString("hex");
        const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.user.update({
          where: { id: existing.id },
          data: { emailVerificationToken, emailVerificationTokenExpiry },
        });
        try {
          await sendVerificationEmail({ to: email, token: emailVerificationToken });
        } catch (err) {
          console.error("[register] Failed to resend verification email:", err);
        }
        return NextResponse.json({ id: existing.id, email: existing.email, role: existing.role, resent: true });
      }
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
        emailVerificationToken,
        emailVerificationTokenExpiry,
      },
    });

    // Send verification email
    try {
      await sendVerificationEmail({ to: email, token: emailVerificationToken });
    } catch (err) {
      console.error("[register] Failed to send verification email:", err);
    }

    // Sanctions screening — fire-and-forget, never blocks registration.
    // Marks the user record with CLEAR or HIT for compliance review.
    void (async () => {
      try {
        const screenTarget = name || email.split("@")[0];
        const result = await screenName(screenTarget);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            sanctionsCheckedAt: new Date(),
            sanctionsStatus: result.hit ? "HIT" : "CLEAR",
            // Auto-upgrade to Tier 1 when sanctions check passes
            ...(result.hit ? {} : { kycTier: 1 }),
          },
        });
        if (result.hit) {
          console.warn(
            `[sanctions] Potential match for new user ${user.id} (${email}): ${result.matches.slice(0, 3).join(", ")}`
          );
        }
      } catch (err) {
        console.warn("[sanctions] Screening failed on registration (non-fatal):", err);
      }
    })();

    return NextResponse.json({ id: user.id, email: user.email, role: user.role });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
