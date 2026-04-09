/**
 * Webhook Service
 * ===============
 * Fires signed outbound HTTP POST requests to user-registered endpoints
 * whenever a key contract lifecycle event occurs.
 *
 * Security:
 *  - Every request body is signed with HMAC-SHA256 using the endpoint's secret.
 *  - Signature is in the `X-Cascrow-Signature` header: "sha256=<hex>".
 *  - Recipients verify: HMAC-SHA256(secret, rawBody) === signature.
 *
 * Reliability:
 *  - Retries up to 3 times with exponential backoff (1s, 2s, 4s).
 *  - Fire-and-forget: never throws, never blocks the caller.
 *  - Respects a 10s timeout per attempt.
 *
 * All events are listed in WEBHOOK_EVENTS below.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// ─── Event catalogue ──────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  "contract.created",
  "contract.funded",
  "contract.expired",
  "proof.submitted",
  "ai.decision",
  "manual_review.required",
  "manual_review.resolved",
  "funds.released",
  "contract.rejected",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string; // ISO 8601
  contractId: string;
  milestoneId?: string;
  data: Record<string, unknown>;
}

// ─── HMAC signing ─────────────────────────────────────────────────────────────

function sign(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

// ─── Single delivery attempt ──────────────────────────────────────────────────

async function deliver(url: string, secret: string, payload: WebhookPayload): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = sign(secret, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Cascrow-Webhook/1.0",
        "X-Cascrow-Event": payload.event,
        "X-Cascrow-Signature": signature,
        "X-Cascrow-Timestamp": payload.timestamp,
      },
      body,
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

async function deliverWithRetry(
  url: string,
  secret: string,
  payload: WebhookPayload,
  maxAttempts = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ok = await deliver(url, secret, payload);
    if (ok) return;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  console.warn(`[webhook] All ${maxAttempts} delivery attempts failed for ${url}`);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fire webhooks for a specific event + user.
 * Looks up all active endpoints for the user that subscribe to this event,
 * then delivers in parallel (fire-and-forget).
 *
 * @param userId  The user who owns the contract (investor or startup)
 * @param event   The event name
 * @param payload The event payload
 */
async function fireForUser(
  userId: string,
  event: WebhookEvent,
  payload: WebhookPayload
): Promise<void> {
  let endpoints: { url: string; secret: string; events: string }[] = [];
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId, active: true },
      select: { url: true, secret: true, events: true },
    });
  } catch (err) {
    console.warn("[webhook] DB lookup failed (non-fatal):", err);
    return;
  }

  const subscribed = endpoints.filter((ep) => {
    try {
      const list = JSON.parse(ep.events) as string[];
      return list.includes(event) || list.includes("*");
    } catch {
      return false;
    }
  });

  if (subscribed.length === 0) return;

  void Promise.allSettled(
    subscribed.map((ep) => deliverWithRetry(ep.url, ep.secret, payload))
  );
}

/**
 * Fire webhooks for an event to ALL parties of a contract (investor + startup).
 * Each party receives a delivery only if they have a registered endpoint for this event.
 * Never throws.
 */
export async function fireWebhook(params: {
  investorId: string;
  startupId?: string | null;
  event: WebhookEvent;
  contractId: string;
  milestoneId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { investorId, startupId, event, contractId, milestoneId, data = {} } = params;
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      contractId,
      milestoneId,
      data,
    };

    const targets = [investorId, ...(startupId ? [startupId] : [])];
    await Promise.allSettled(targets.map((uid) => fireForUser(uid, event, payload)));
  } catch (err) {
    console.warn("[webhook] fireWebhook failed (non-fatal):", err);
  }
}
