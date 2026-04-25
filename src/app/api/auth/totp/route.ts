import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

// GET /api/auth/totp — returns current 2FA status
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true },
  });

  return NextResponse.json({ totpEnabled: user?.totpEnabled ?? false });
}

// POST /api/auth/totp — generate a new TOTP secret + QR code (not yet enabled)
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, totpEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.totpEnabled) return NextResponse.json({ error: "2FA is already enabled" }, { status: 400 });

  const secret = generateSecret();
  const otpauthUrl = generateURI({ secret, label: `Cascrow:${user.email}`, issuer: "Cascrow" });
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Save secret temporarily (not yet enabled — only activated after verify)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret },
  });

  return NextResponse.json({ secret, qrDataUrl });
}

// PUT /api/auth/totp — verify code and enable 2FA
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { code?: string };
  if (!body.code || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "A 6-digit code is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });
  if (!user?.totpSecret) return NextResponse.json({ error: "No setup in progress" }, { status: 400 });
  if (user.totpEnabled) return NextResponse.json({ error: "2FA already enabled" }, { status: 400 });

  const result = await verifyTotp({ token: body.code, secret: user.totpSecret });
  if (!result.valid) return NextResponse.json({ error: "Invalid code — check your authenticator app" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: true },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/auth/totp — disable 2FA (requires password + current TOTP code)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { password?: string; code?: string };
  if (!body.password || !body.code) {
    return NextResponse.json({ error: "Password and current 2FA code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true, totpSecret: true, totpEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  if (!user.passwordHash) return NextResponse.json({ error: "Google accounts cannot use 2FA password verification" }, { status: 400 });
  const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
  if (!passwordValid) return NextResponse.json({ error: "Incorrect password" }, { status: 400 });

  const codeResult = await verifyTotp({ token: body.code, secret: user.totpSecret });
  if (!codeResult.valid) return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: false, totpSecret: null },
  });

  return NextResponse.json({ ok: true });
}
