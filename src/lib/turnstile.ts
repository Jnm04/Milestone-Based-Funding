/**
 * Server-side Cloudflare Turnstile token verification.
 * Call this in API routes before processing any form submission.
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Fail closed in production — never silently bypass bot protection
      console.error("[turnstile] TURNSTILE_SECRET_KEY not set in production — rejecting request");
      return false;
    }
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — skipping verification (dev only)");
    return true;
  }
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] Verification request failed:", err);
    return false;
  }
}
