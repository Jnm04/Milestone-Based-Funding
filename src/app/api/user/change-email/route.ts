import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmailChangeVerification } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingEmail: cleaned, emailChangeToken: token, emailChangeTokenExpiry: expiry },
  });

  await sendEmailChangeVerification({ to: cleaned, token, currentEmail: user.email });

  return NextResponse.json({ ok: true });
}
