import crypto from "crypto";
import { NextRequest } from "next/server";

const MIN_SECRET_LENGTH = 32;
const SIG_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const COOKIE_NAME = "cascrow_admin";

// H5: nonce store — prevents replay of captured HMAC-signed requests within the window
const usedNonces = new Map<string, number>(); // nonce → expiry timestamp
let lastNonceCleanup = 0;

function evictExpiredNonces(): void {
  const now = Date.now();
  if (now - lastNonceCleanup < 60_000) return;
  lastNonceCleanup = now;
  for (const [k, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(k);
  }
}

/** Derives the same session token used by /api/internal/auth. */
function makeSessionToken(secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update("admin-session-v1")
    .digest("hex");
}

/**
 * Validates internal admin API requests.
 *
 * Auth precedence (first match wins):
 *
 * 1. HTTP-only cookie `cascrow_admin` — preferred, set by /api/internal/auth
 *    on successful login. Invisible to JavaScript.
 *
 * 2. HMAC-SHA256 signed headers (legacy programmatic access):
 *    x-internal-key:  the raw secret (constant-time compared)
 *    x-internal-ts:   Unix millisecond timestamp (must be within ±5 min)
 *    x-internal-sig:  sha256=<HMAC-SHA256(secret, method:pathname:ts)>
 *
 * 3. Plain key header fallback — logs a warning on every call.
 */
export function isInternalAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_SECRET?.trim() ?? "";
  if (!secret) return false;

  if (secret.length < MIN_SECRET_LENGTH) {
    console.error(
      `[internal-auth] INTERNAL_SECRET is too short (${secret.length} chars, minimum ${MIN_SECRET_LENGTH}). ` +
        "Generate a new one with: openssl rand -hex 32"
    );
    return false;
  }

  // ── 1. HTTP-only cookie (preferred) ────────────────────────────────────────
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value ?? "";
  if (cookieToken) {
    const expected = makeSessionToken(secret);
    if (cookieToken.length === expected.length) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(expected))) {
          return true;
        }
      } catch { /* fall through */ }
    }
  }

  // ── 2. HMAC + timestamp headers (programmatic / legacy) ───────────────────
  const key = req.headers.get("x-internal-key")?.trim() ?? "";
  if (!key) return false;

  const sig = req.headers.get("x-internal-sig") ?? "";
  const tsHeader = req.headers.get("x-internal-ts") ?? "";

  if (sig && tsHeader) {
    const ts = parseInt(tsHeader, 10);
    if (isNaN(ts)) return false;

    if (Math.abs(Date.now() - ts) > SIG_WINDOW_MS) return false;

    // H5: reject replayed requests — nonce = timestamp + raw signature (unique per call)
    const nonce = `${tsHeader}:${sig}`;
    evictExpiredNonces();
    if (usedNonces.has(nonce)) return false;

    const method = req.method.toUpperCase();
    const pathname = req.nextUrl.pathname;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${method}:${pathname}:${tsHeader}`)
      .digest("hex");

    const provided = sig.startsWith("sha256=") ? sig.slice(7) : sig;

    const lenKey = Math.max(Buffer.byteLength(key), Buffer.byteLength(secret));
    const aKey = Buffer.alloc(lenKey);
    const bKey = Buffer.alloc(lenKey);
    Buffer.from(key).copy(aKey);
    Buffer.from(secret).copy(bKey);

    const lenSig = Math.max(Buffer.byteLength(provided), Buffer.byteLength(expected));
    const aSig = Buffer.alloc(lenSig);
    const bSig = Buffer.alloc(lenSig);
    Buffer.from(provided).copy(aSig);
    Buffer.from(expected).copy(bSig);

    const isValid = crypto.timingSafeEqual(aKey, bKey) && crypto.timingSafeEqual(aSig, bSig);
    if (isValid) usedNonces.set(nonce, Date.now() + SIG_WINDOW_MS);
    return isValid;
  }

  // ── 3. Plain key fallback (no replay protection) ───────────────────────────
  console.warn(
    "[internal-auth] Request missing HMAC signature headers (x-internal-sig / x-internal-ts). " +
      "Falling back to plain key check. Update the caller to use internalFetch()."
  );
  const len = Math.max(Buffer.byteLength(key), Buffer.byteLength(secret));
  const a = Buffer.alloc(len);
  const b = Buffer.alloc(len);
  Buffer.from(key).copy(a);
  Buffer.from(secret).copy(b);
  return crypto.timingSafeEqual(a, b);
}
