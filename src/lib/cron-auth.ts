import crypto from "crypto";

const MIN_SECRET_LENGTH = 32;

/**
 * Validates the Authorization header for Vercel Cron invocations.
 *
 * Vercel sends:  Authorization: Bearer <CRON_SECRET>
 *
 * Uses constant-time comparison to prevent timing attacks.
 * Rejects if CRON_SECRET is shorter than 32 characters — use
 * `openssl rand -hex 32` to generate a suitable value.
 *
 * Usage:
 *   if (!isValidCronSecret(request.headers.get("authorization"))) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */
export function isValidCronSecret(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;

  if (secret.length < MIN_SECRET_LENGTH) {
    console.error(
      `[cron-auth] CRON_SECRET is too short (${secret.length} chars, minimum ${MIN_SECRET_LENGTH}). ` +
        "Generate a new one with: openssl rand -hex 32"
    );
    return false;
  }

  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (provided.length === 0) return false;

  try {
    // HMAC both values before comparing so timingSafeEqual always gets equal-length buffers
    // and length differences don't leak timing information.
    const ha = crypto.createHmac("sha256", "cascrow").update(provided).digest();
    const hb = crypto.createHmac("sha256", "cascrow").update(secret).digest();
    return crypto.timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}
