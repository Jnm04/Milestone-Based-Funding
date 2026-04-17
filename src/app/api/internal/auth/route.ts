import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "cascrow_admin";
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours
const MIN_SECRET_LENGTH = 32;

/** Derives a deterministic session token from the INTERNAL_SECRET. */
function makeSessionToken(secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update("admin-session-v1")
    .digest("hex");
}

function getSecret(): string {
  return process.env.INTERNAL_SECRET?.trim() ?? "";
}

/** GET — returns 200 if the current session cookie is valid, 401 otherwise. */
export async function GET(req: NextRequest) {
  const secret = getSecret();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const cookieToken = req.cookies.get(COOKIE_NAME)?.value ?? "";
  if (!cookieToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const expected = makeSessionToken(secret);
  if (cookieToken.length !== expected.length) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(expected)
    );
    return valid
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false }, { status: 401 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

/** POST — verify raw key, set HTTP-only session cookie. */
export async function POST(req: NextRequest) {
  const secret = getSecret();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let key: string;
  try {
    const body = await req.json();
    key = (body.key ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!key) {
    return NextResponse.json({ error: "Key required" }, { status: 400 });
  }

  const len = Math.max(key.length, secret.length);
  const keyBuf = Buffer.alloc(len);
  const secretBuf = Buffer.alloc(len);
  Buffer.from(key).copy(keyBuf);
  Buffer.from(secret).copy(secretBuf);

  let timingMatch = false;
  try {
    timingMatch = crypto.timingSafeEqual(keyBuf, secretBuf);
  } catch {
    /* noop */
  }

  if (!timingMatch || key.length !== secret.length) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

/** DELETE — clear the session cookie (logout). */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
