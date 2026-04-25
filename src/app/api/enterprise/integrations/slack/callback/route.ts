import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { parseSlackState } from "../connect/route";

const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not set — refusing to store Slack token unencrypted");
  }
  const key = crypto.scryptSync(ENCRYPTION_KEY, "slack-token-salt", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * GET /api/enterprise/integrations/slack/callback
 * Handles Slack OAuth callback — exchanges code for access token and saves it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${BASE_URL}/profile?slackError=1`);
  }

  const parsed = parseSlackState(state);
  if (!parsed) {
    return NextResponse.redirect(`${BASE_URL}/profile?slackError=1`);
  }
  const userId = parsed.userId;

  if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
    return NextResponse.redirect(`${BASE_URL}/profile?slackError=1`);
  }

  const redirectUri = `${BASE_URL}/api/enterprise/integrations/slack/callback`;
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json() as {
    ok: boolean;
    access_token?: string;
    authed_user?: { id: string };
    incoming_webhook?: { channel: string; channel_id: string };
    error?: string;
  };

  if (!tokenData.ok || !tokenData.access_token) {
    return NextResponse.redirect(`${BASE_URL}/profile?slackError=1`);
  }

  let encryptedToken: string;
  try {
    encryptedToken = encryptToken(tokenData.access_token);
  } catch (encryptErr) {
    console.error("[slack/callback] Token encryption failed:", encryptErr);
    return NextResponse.redirect(`${BASE_URL}/profile?slackError=1`);
  }
  const channelId = tokenData.incoming_webhook?.channel_id ?? null;
  const channelName = tokenData.incoming_webhook?.channel ?? null;

  await prisma.notificationIntegration.upsert({
    where: { userId_type: { userId, type: "slack" } },
    create: {
      userId,
      type: "slack",
      accessToken: encryptedToken,
      channelId,
      channelName,
      events: ["attestation.completed", "attestation.failed", "deadline.approaching", "connector.error"],
    },
    update: {
      accessToken: encryptedToken,
      channelId,
      channelName,
    },
  });

  return NextResponse.redirect(`${BASE_URL}/profile?slackConnected=1`);
}
