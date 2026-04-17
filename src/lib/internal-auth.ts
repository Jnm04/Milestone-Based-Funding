import crypto from "crypto";
import { NextRequest } from "next/server";

const MIN_SECRET_LENGTH = 32;
const SIG_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Validates internal admin API requests.
 *
 * Accepts HMAC-SHA256 signed requests (preferred):
 *   x-internal-key:  the raw secret (constant-time compared)
 *   x-internal-ts:   Unix millisecond timestamp (must be within ±5 min)
 *   x-internal-sig:  sha256=<HMAC-SHA256(secret, method:pathname:ts)>
 *
 * Falls back to plain key-only if the signature headers are absent —
 * this allows existing callers to keep working while being migrated.
 * A warning is logged on every plain-key request.
 */
export function isInternalAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-internal-key")?.trim() ?? "";
  const secret = process.env.INTERNAL_SECRET?.trim() ?? "";
  if (!key || !secret) return false;

  if (secret.length < MIN_SECRET_LENGTH) {
    console.error(
      `[internal-auth] INTERNAL_SECRET is too short (${secret.length} chars, minimum ${MIN_SECRET_LENGTH}). ` +
        "Generate a new one with: openssl rand -hex 32"
    );
    return false;
  }

  const sig = req.headers.get("x-internal-sig") ?? "";
  const tsHeader = req.headers.get("x-internal-ts") ?? "";

  // ── HMAC + timestamp path (preferred) ──────────────────────────────────────
  if (sig && tsHeader) {
    const ts = parseInt(tsHeader, 10);
    if (isNaN(ts)) return false;

    if (Math.abs(Date.now() - ts) > SIG_WINDOW_MS) return false;

    const method = req.method.toUpperCase();
    const pathname = req.nextUrl.pathname;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${method}:${pathname}:${tsHeader}`)
      .digest("hex");

    const provided = sig.startsWith("sha256=") ? sig.slice(7) : sig;

    // Constant-time comparison for both key and signature
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

    return crypto.timingSafeEqual(aKey, bKey) && crypto.timingSafeEqual(aSig, bSig);
  }

  // ── Plain key fallback (no replay protection — migration only) ─────────────
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
