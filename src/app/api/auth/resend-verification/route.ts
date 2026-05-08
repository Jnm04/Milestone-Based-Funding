import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

// Minimum seconds between resend requests per email address
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // 10 resend requests per IP per hour (per-email cooldown also applies below)
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`resend-verify:${ip}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json({ ok: true }); // Silent block — no enumeration
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ ok: true }); // Silent — no enumeration
    }

    const user = await prisma.user.findUnique({ where: { email: email.trim() } });

    // Return success even if user not found — don't leak whether an email is registered
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    // Enforce cooldown: check if existing token was issued less than 60s ago.
    // Return ok:true (not 429) to avoid revealing whether this email has a pending account.
    if (user.emailVerificationTokenExpiry) {
      const tokenCreatedAt = user.emailVerificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000;
      const timeSinceIssue = Date.now() - tokenCreatedAt;
      if (timeSinceIssue < RESEND_COOLDOWN_MS) {
        return NextResponse.json({ ok: true });
      }
    }

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationTokenHash = crypto.createHash("sha256").update(emailVerificationToken).digest("hex");
    const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: emailVerificationTokenHash, emailVerificationTokenExpiry },
    });

    try {
      await sendVerificationEmail({ to: email.trim(), token: emailVerificationToken });
    } catch (err) {
      console.error("[resend-verification] Failed to send email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-verification]", err);
    return NextResponse.json({ error: "Failed to resend verification email" }, { status: 500 });
  }
}
