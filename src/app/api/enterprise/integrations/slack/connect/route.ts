import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import crypto from "crypto";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_SCOPES = "chat:write,channels:read,groups:read";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "";

function signState(payload: string): string {
  return crypto.createHmac("sha256", ENCRYPTION_KEY || "insecure-fallback").update(payload).digest("hex");
}

export function buildSlackState(userId: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = Buffer.from(JSON.stringify({ userId, nonce })).toString("base64url");
  const sig = signState(payload);
  return `${payload}.${sig}`;
}

export function parseSlackState(state: string): { userId: string } | null {
  const dot = state.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = signState(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

/**
 * GET /api/enterprise/integrations/slack/connect
 * Redirects to Slack OAuth. State is HMAC-signed to prevent CSRF.
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SLACK_CLIENT_ID) {
    return NextResponse.json({ error: "Slack integration not configured" }, { status: 503 });
  }

  const state = buildSlackState(session.user.id);
  const redirectUri = `${BASE_URL}/api/enterprise/integrations/slack/callback`;

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", SLACK_CLIENT_ID);
  url.searchParams.set("scope", SLACK_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
