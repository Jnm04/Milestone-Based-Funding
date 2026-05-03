import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  name: z.string().max(200).optional(),
  keyName: z.string().max(80).optional().default("default"),
});

// POST /api/agent/register
// Programmatic agent registration — no email verification, no Turnstile.
// Returns an API key immediately so agents can start calling Cascrow without a human in the loop.
// Rate-limited strictly: 3 registrations per IP per hour.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`agent-register:${ip}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many registrations from this IP. Try again in 1 hour." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { email, password, name, keyName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? null,
      role: "INVESTOR",
      emailVerified: true,
      kycTier: 1,
    },
  });

  const rawKey = "csk_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: keyName ?? "default",
      keyHash,
      keyPrefix,
    },
  });

  return NextResponse.json(
    {
      userId: user.id,
      email: user.email,
      apiKey: rawKey,
      message: "Agent registered. Save your API key — it will not be shown again.",
    },
    { status: 201 }
  );
}
