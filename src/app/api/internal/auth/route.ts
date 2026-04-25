import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "cascrow_admin";
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours
const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE * 1000;
const MIN_SECRET_LENGTH = 32;

/**
 * Cookie format: "<issuedAt>.<hmac>"
 * The HMAC covers both the secret and the issuedAt timestamp so the server can
 * enforce expiry independently of the browser's cookie maxAge.
 */
function makeSessionToken(secret: string, issuedAt: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`admin-session-v2:${issuedAt}`)
    .digest("hex");
}

function makeSessionCookieValue(secret: string): string {
  const issuedAt = Date.now();
  return `${issuedAt}.${makeSessionToken(secret, issuedAt)}`;
}

function verifySessionCookieValue(secret: string, cookieValue: string): boolean {
  const dot = cookieValue.indexOf(".");
  if (dot === -1) return false;
  const issuedAt = parseInt(cookieValue.slice(0, dot), 10);
  if (isNaN(issuedAt) || Date.now() - issuedAt > COOKIE_MAX_AGE_MS) return false;
  const actual = cookieValue.slice(dot + 1);
  const expected = makeSessionToken(secret, issuedAt);
  if (actual.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
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

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value ?? "";
  if (!cookieValue) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return verifySessionCookieValue(secret, cookieValue)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 401 });
}

/** POST — verify raw key, set HTTP-only session cookie. */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? "unknown";
  if (!(await checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

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
  cookieStore.set(COOKIE_NAME, makeSessionCookieValue(secret), {
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
