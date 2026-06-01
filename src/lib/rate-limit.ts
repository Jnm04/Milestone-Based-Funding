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

// ─── Main exports ─────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in milliseconds
}

function checkRateLimitMemoryFull(key: string, limit: number, windowMs: number): RateLimitResult {
  maybeClean();
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }

  const allowed = entry.count < limit;
  if (allowed) entry.count++;
  return { allowed, limit, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

/**
 * Like checkRateLimit but returns metadata for X-RateLimit-* response headers.
 * Use this in routes where you want to expose rate limit state to callers.
 */
export async function checkRateLimitFull(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!redis) return checkRateLimitMemoryFull(key, limit, windowMs);

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    let resetAt: number;
    try {
      const pttl = await redis.pttl(key);
      resetAt = pttl > 0 ? Date.now() + pttl : Date.now() + windowMs;
    } catch {
      resetAt = Date.now() + windowMs;
    }
    return { allowed: count <= limit, limit, remaining: Math.max(0, limit - count), resetAt };
  } catch {
    return checkRateLimitMemoryFull(key, limit, windowMs);
  }
}

/** Convenience: add X-RateLimit-* headers to a Headers-compatible object. */
export function applyRateLimitHeaders(headers: Record<string, string>, result: RateLimitResult): void {
  headers["X-RateLimit-Limit"] = String(result.limit);
  headers["X-RateLimit-Remaining"] = String(result.remaining);
  headers["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000));
}

/**
 * Returns true if the request is within the limit, false if it should be blocked.
 *
 * @param key     Unique bucket key, e.g. `"register:<ip>"`
 * @param limit   Max requests allowed per window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  return (await checkRateLimitFull(key, limit, windowMs)).allowed;
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
