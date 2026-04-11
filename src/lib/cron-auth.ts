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
    // Pad to same length before comparing to avoid length-based timing leaks
    const a = Buffer.from(provided.padEnd(secret.length, "\0"));
    const b = Buffer.from(secret.padEnd(provided.length, "\0"));
    // timingSafeEqual requires same-length buffers
    const len = Math.max(a.length, b.length);
    return (
      provided.length === secret.length &&
      crypto.timingSafeEqual(
        Buffer.from(provided.padEnd(len)),
        Buffer.from(secret.padEnd(len))
      )
    );
  } catch {
    return false;
  }
}
