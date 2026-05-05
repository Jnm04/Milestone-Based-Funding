import { prisma } from "@/lib/prisma";

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

  let httpStatus: number | null = null;
  let delivered = false;

  try {
    const res = await fetch(callbackUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        event:      payload.event,
        contractId: payload.contractId ?? null,
        milestoneId: payload.milestoneId ?? null,
        data:       payload.data ?? {},
        timestamp:  new Date().toISOString(),
      }),
      // 10-second timeout — agent endpoints must respond quickly
      signal: AbortSignal.timeout(10_000),
    });
    httpStatus = res.status;
    delivered  = res.status >= 200 && res.status < 300;
  } catch (err) {
    // Network error, timeout, or DNS failure — recorded as null status
    console.error("[agent-callback] Delivery failed:", err);
  }

  // Persist log non-fatally
  prisma.agentCallbackLog
    .create({
      data: {
        agentUserId,
        event:      payload.event,
        contractId: payload.contractId ?? null,
        milestoneId: payload.milestoneId ?? null,
        httpStatus,
        delivered,
      },
    })
    .catch((err) => console.error("[agent-callback] Failed to log delivery:", err));
}
