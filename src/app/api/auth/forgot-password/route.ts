import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // N2: normalize response timing — always wait at least 400ms so timing
    // side-channels cannot reveal whether a given email is registered.
    const minDelay = new Promise<void>((r) => setTimeout(r, 400));

    // 5 password-reset emails per IP per hour — prevents email flooding
    const ip = getClientIp(request);
    if (!checkRateLimit(`forgot-pw:${ip}`, 5, 60 * 60 * 1000)) {
      await minDelay;
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

    // Always respond with ok — never reveal whether the email exists.
    // Await minDelay to ensure consistent response time regardless of DB result.
    await minDelay;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ ok: true });
  }
}
