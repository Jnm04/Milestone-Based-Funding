import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const TOKEN_EXPIRY = "30d";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`mobile-login:${ip}`, 20, 15 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait before trying again." },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: "E-Mail und Passwort erforderlich." }, { status: 400 });
  }
  if (email.length > 254 || password.length > 72) {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      walletAddress: true,
      isEnterprise: true,
      avatarUrl: true,
      passwordHash: true,
      emailVerified: true,
      loginAttempts: true,
      lockoutUntil: true,
    },
  });

  if (!user) {
    // Constant-time dummy compare to prevent user enumeration timing attacks
    await bcrypt.compare(password, "$2a$12$invalidhashpadding000000000000000000000000000000000000");
    return NextResponse.json({ error: "E-Mail oder Passwort falsch." }, { status: 401 });
  }

  if (user.lockoutUntil && user.lockoutUntil > new Date()) {
    return NextResponse.json(
      { error: "Konto vorübergehend gesperrt. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }

  if (!user.passwordHash) {
    return NextResponse.json({ error: "E-Mail oder Passwort falsch." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.loginAttempts + 1;
    const lockoutUntil =
      newAttempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: newAttempts, lockoutUntil },
    });
    return NextResponse.json({ error: "E-Mail oder Passwort falsch." }, { status: 401 });
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      { error: "Bitte bestätige zuerst deine E-Mail-Adresse." },
      { status: 403 }
    );
  }

  if (user.loginAttempts > 0 || user.lockoutUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockoutUntil: null },
    });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  const token = await new SignJWT({ sub: user.id, email: user.email, role: user.role, walletAddress: user.walletAddress })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secret);

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      walletAddress: user.walletAddress,
      isEnterprise: user.isEnterprise,
      avatarUrl: user.avatarUrl,
    },
  });
}
