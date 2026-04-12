import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // 5 password-reset emails per IP per hour — prevents email flooding
    const ip = getClientIp(request);
    if (!checkRateLimit(`forgot-pw:${ip}`, 5, 60 * 60 * 1000)) {
      // Return ok to avoid leaking info, but don't actually send the email
      return NextResponse.json({ ok: true });
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string" || email.length > 254) {
      return NextResponse.json({ ok: true }); // Always return ok — no user enumeration
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.emailVerified) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: token, passwordResetTokenExpiry: expiry },
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
