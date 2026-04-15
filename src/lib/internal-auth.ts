import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Validates the x-internal-key header against INTERNAL_SECRET using
 * constant-time comparison to prevent timing-based brute-force attacks.
 */
export function isInternalAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-internal-key")?.trim() ?? "";
  const secret = process.env.INTERNAL_SECRET?.trim() ?? "";
  if (!key || !secret) return false;
  // Pad both to the same length so timingSafeEqual doesn't throw
  const len = Math.max(Buffer.byteLength(key), Buffer.byteLength(secret));
  const a = Buffer.alloc(len);
  const b = Buffer.alloc(len);
  Buffer.from(key).copy(a);
  Buffer.from(secret).copy(b);
  return crypto.timingSafeEqual(a, b);
}
