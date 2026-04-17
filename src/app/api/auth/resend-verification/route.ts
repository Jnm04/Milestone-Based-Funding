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

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Return success even if user not found — don't leak whether an email is registered
    if (!user || user.emailVerified) {
      return NextResponse.json({ ok: true });
    }

    // Enforce cooldown: check if existing token was issued less than 60s ago
    if (user.emailVerificationTokenExpiry) {
      const tokenAge = Date.now() - (user.emailVerificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000);
      if (tokenAge < RESEND_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((RESEND_COOLDOWN_MS - tokenAge) / 1000);
        return NextResponse.json(
          { error: `Please wait ${secondsLeft} seconds before requesting another email.` },
          { status: 429 }
        );
      }
    }

    const emailVerificationToken = crypto.randomBytes(32).toString("hex");
    const emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken, emailVerificationTokenExpiry },
    });

    try {
      await sendVerificationEmail({ to: email, token: emailVerificationToken });
    } catch (err) {
      console.error("[resend-verification] Failed to send email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
