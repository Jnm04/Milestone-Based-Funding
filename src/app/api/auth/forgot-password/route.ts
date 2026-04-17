import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // 5 password-reset emails per IP per hour — prevents email flooding
    const ip = getClientIp(request);
    if (!checkRateLimit(`forgot-pw:${ip}`, 5, 60 * 60 * 1000)) {
      // Return ok to avoid leaking info, but don't actually send the email
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();
    const { email, turnstileToken } = body;

    // Turnstile bot protection — fail silently (return ok) to avoid info leak
    if (!(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ ok: true });
    }

    if (!email || typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ ok: true }); // Always return ok — no user enumeration
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.emailVerified) {
      const token = crypto.randomBytes(32).toString("hex");
      // Store only the SHA-256 hash in DB — raw token is sent to the user via email only.
      // If the DB is leaked, stored hashes cannot be used to reset passwords directly.
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: tokenHash, passwordResetTokenExpiry: expiry },
      });

      try {
        await sendPasswordResetEmail({ to: email, token });
      } catch (err) {
        console.error("[forgot-password] Email send failed:", err);
      }
    }

    // Always respond with ok — never reveal whether the email exists
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ ok: true });
  }
}
