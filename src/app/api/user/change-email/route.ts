import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmailChangeVerification, sendEmailChangeSecurityAlert } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 5 email-change requests per hour — prevents email-flooding abuse
  if (!(await checkRateLimit(`change-email:${session.user.id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const body = await req.json() as { newEmail?: string; currentPassword?: string };
  const { newEmail, currentPassword } = body;

  if (!newEmail || typeof newEmail !== "string") {
    return NextResponse.json({ error: "New email is required" }, { status: 400 });
  }
  const cleaned = newEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (cleaned.length > 254) {
    return NextResponse.json({ error: "Email too long" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (cleaned === user.email) {
    return NextResponse.json({ error: "This is already your current email" }, { status: 400 });
  }

  // Password required for credentials accounts
  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 400 });
  }

  // Check new email not already taken
  const existing = await prisma.user.findUnique({ where: { email: cleaned }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "This email address is already in use" }, { status: 409 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingEmail: cleaned, emailChangeToken: tokenHash, emailChangeTokenExpiry: expiry },
  });

  await sendEmailChangeVerification({ to: cleaned, token, currentEmail: user.email });
  // Alert the current email address so the account holder knows a change was requested
  void sendEmailChangeSecurityAlert({ to: user.email, newEmail: cleaned }).catch(() => {});

  return NextResponse.json({ ok: true });
}
