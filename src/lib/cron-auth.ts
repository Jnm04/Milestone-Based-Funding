import crypto from "crypto";

/**
 * Validates the Authorization header for cron/internal calls.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * Usage:
 *   if (!isValidCronSecret(request.headers.get("authorization"))) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */
export function isValidCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (provided.length === 0) return false;

  try {
    const len = Math.max(provided.length, secret.length);
    const a = Buffer.alloc(len);
    const b = Buffer.alloc(len);
    Buffer.from(provided).copy(a);
    Buffer.from(secret).copy(b);
    // Always run timingSafeEqual (no short-circuit) — length equality checked separately
    // and combined with bitwise AND so both checks always execute in constant time.
    const sameLength = provided.length === secret.length ? 1 : 0;
    return crypto.timingSafeEqual(a, b) && sameLength === 1;
  } catch {
    return false;
  }
}
