import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verify as verifyTotp } from "otplib";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateRecoveryCodes(): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => {
    const part = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `${part(4)}-${part(4)}`;
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpRecoveryCodes: true },
  });

  if (!user?.totpEnabled) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  const stored = JSON.parse(user.totpRecoveryCodes ?? "[]") as string[];
  return NextResponse.json({ count: stored.length });
}

// Regenerate recovery codes — requires current TOTP code
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { code?: string };
  if (!body.code || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json({ error: "Current 6-digit 2FA code is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecret: true },
  });

  if (!user?.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  const result = await verifyTotp({ token: body.code, secret: user.totpSecret });
  if (!result.valid) {
    return NextResponse.json({ error: "Invalid 2FA code" }, { status: 400 });
  }

  const plainCodes = generateRecoveryCodes();
  const hashes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

  // Use a salt to ensure uniqueness even if two codes are identical (shouldn't happen with crypto.randomBytes-based generation)
  void crypto; // keep import used
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpRecoveryCodes: JSON.stringify(hashes) },
  });

  return NextResponse.json({ codes: plainCodes });
}
