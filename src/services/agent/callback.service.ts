import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

export type AgentCallbackEvent =
  | "handoff.received"
  | "milestone.funded"
  | "milestone.verified"
  | "milestone.rejected";

interface CallbackPayload {
  event:       AgentCallbackEvent;
  contractId?: string;
  milestoneId?: string;
  data?:       Record<string, unknown>;
}

// Best-effort: fire and forget. Never throws — logs to AgentCallbackLog.
// Called from verify/route.ts, fund-milestone/route.ts, and handoff/route.ts.
export async function fireAgentCallback(
  agentUserId: string,
  payload: CallbackPayload
): Promise<void> {
  let callbackUrl: string | null = null;
  try {
    const user = await prisma.user.findUnique({
      where:  { id: agentUserId },
      select: { agentCallbackUrl: true },
    });
    callbackUrl = user?.agentCallbackUrl ?? null;
  } catch (err) {
    console.error("[agent-callback] Failed to look up callbackUrl:", err);
    return;
  }

  if (!callbackUrl) return;

  const body = JSON.stringify({
    event:       payload.event,
    contractId:  payload.contractId  ?? null,
    milestoneId: payload.milestoneId ?? null,
    data:        payload.data        ?? {},
    timestamp:   new Date().toISOString(),
  });

  // HMAC-SHA256 over the raw body so receivers can verify origin.
  // If the env var is absent the header is omitted — existing receivers still work.
  const secret = process.env.CASCROW_CALLBACK_SECRET;
  const signature = secret
    ? "sha256=" + createHmac("sha256", secret).update(body).digest("hex")
    : null;

  let httpStatus: number | null = null;
  let delivered = false;

  try {
    const res = await fetch(callbackUrl, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "X-Cascrow-Signature": signature } : {}),
      },
      body,
      redirect: "error",   // never follow redirects — blocks SSRF via open redirects
      signal: AbortSignal.timeout(10_000),
    });
    httpStatus = res.status;
    delivered  = res.status >= 200 && res.status < 300;
  } catch (err) {
    // Network error, timeout, redirect attempt, or DNS failure
    console.error("[agent-callback] Delivery failed:", err);
  }

  // Persist log non-fatally
  prisma.agentCallbackLog
    .create({
      data: {
        agentUserId,
        event:       payload.event,
        contractId:  payload.contractId  ?? null,
        milestoneId: payload.milestoneId ?? null,
        httpStatus,
        delivered,
      },
    })
    .catch((err) => console.error("[agent-callback] Failed to log delivery:", err));
}
