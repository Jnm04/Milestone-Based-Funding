import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertPublicUrl } from "@/lib/validate-url";
import { z } from "zod";

const schema = z.object({
  discoverable: z.boolean().optional(),
  skills: z
    .array(z.string().min(1).max(50))
    .max(20)
    .optional(),
  callbackUrl: z
    .string()
    .url("callbackUrl must be a valid HTTPS URL")
    .refine((v) => v.startsWith("https://"), { message: "callbackUrl must use HTTPS" })
    .nullable()
    .optional(),
});

// PATCH /api/agent/settings
// Agent-only. Sets discoverable flag, skill tags, and callback URL.
export async function PATCH(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  if (!(await checkRateLimit(`agent-settings:${apiKeyCtx.userId}`, 10, 60_000))) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { discoverable, skills, callbackUrl } = parsed.data;

  if (callbackUrl) {
    try {
      assertPublicUrl(callbackUrl);
    } catch {
      return NextResponse.json({ error: "callbackUrl must point to a public HTTPS address" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if (discoverable !== undefined) data.agentDiscoverable = discoverable;
  if (skills       !== undefined) data.agentSkills       = JSON.stringify(skills);
  if (callbackUrl  !== undefined) data.agentCallbackUrl  = callbackUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: apiKeyCtx.userId },
    data,
    select: {
      agentDiscoverable: true,
      agentSkills:       true,
      agentCallbackUrl:  true,
      walletAddress:     true,
    },
  });

  return NextResponse.json({
    discoverable:  updated.agentDiscoverable,
    skills:        (() => { try { return updated.agentSkills ? (JSON.parse(updated.agentSkills) as string[]) : []; } catch { return []; } })(),
    callbackUrl:   updated.agentCallbackUrl ?? null,
    walletAddress: updated.walletAddress ?? null,
    profileUrl:    updated.walletAddress ? `/agent/${updated.walletAddress}` : null,
  });
}

// GET /api/agent/settings
// Returns the current agent's settings.
export async function GET(request: NextRequest) {
  const apiKeyCtx = await resolveApiKey(request.headers.get("authorization"));
  if (!apiKeyCtx) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: apiKeyCtx.userId },
    select: {
      agentDiscoverable: true,
      agentSkills:       true,
      agentCallbackUrl:  true,
      walletAddress:     true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    discoverable:  user.agentDiscoverable,
    skills:        (() => { try { return user.agentSkills ? (JSON.parse(user.agentSkills) as string[]) : []; } catch { return []; } })(),
    callbackUrl:   user.agentCallbackUrl ?? null,
    walletAddress: user.walletAddress ?? null,
    profileUrl:    user.walletAddress ? `/agent/${user.walletAddress}` : null,
  });
}
