/**
 * Rate limiter for server-side API routes.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set (production on Vercel).
 * Falls back to an in-memory store for local development.
 *
 * Usage:
 *   const ip = getClientIp(request);
 *   if (!(await checkRateLimit(`register:${ip}`, 10, 60 * 60 * 1000))) {
 *     return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *   }
 */

import { NextRequest } from "next/server";
import { Redis } from "@upstash/redis";

// ─── Redis client (production) ────────────────────────────────────────────────

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// ─── In-memory fallback (local dev) ───────────────────────────────────────────

interface Entry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Entry>();

let callsSinceClean = 0;
function maybeClean() {
  if (++callsSinceClean < 500) return;
  callsSinceClean = 0;
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}

function checkRateLimitMemory(key: string, limit: number, windowMs: number): boolean {
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

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns true if the request is within the limit, false if it should be blocked.
 *
 * @param key     Unique bucket key, e.g. `"register:<ip>"`
 * @param limit   Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!redis) return checkRateLimitMemory(key, limit, windowMs);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First hit in this window — set expiry (TTL in seconds)
      await redis.pexpire(key, windowMs);
    }
    return count <= limit;
  } catch {
    // Redis unavailable — fail open (allow request) to preserve availability
    return true;
  }
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
