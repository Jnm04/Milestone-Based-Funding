/**
 * In-memory rate limiter for server-side API routes.
 *
 * Limitations (acceptable for current scale):
 * - Per-instance: each serverless function instance has its own counter.
 *   Upgrade path: replace `memoryStore` with Upstash Redis calls when needed.
 * - Counters reset on cold start — adds some leakage, but still blocks burst abuse.
 *
 * Usage:
 *   const ip = getClientIp(request);
 *   if (!checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { NextRequest } from "next/server";

interface Entry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Entry>();

// Prune expired entries every 500 calls to prevent unbounded memory growth.
let callsSinceClean = 0;
function maybeClean() {
  if (++callsSinceClean < 500) return;
  callsSinceClean = 0;
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}

/**
 * Returns true if the request is within the limit, false if it should be blocked.
 *
 * @param key     Unique bucket key, e.g. `"register:<ip>"`
 * @param limit   Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  maybeClean();
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/**
 * Extracts the real client IP from standard Vercel / proxy headers.
 * Falls back to "unknown" when no header is present (e.g. local dev).
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
