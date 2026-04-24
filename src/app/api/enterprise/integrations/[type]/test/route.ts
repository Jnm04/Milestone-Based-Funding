import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { isValidTeamsWebhookUrl } from "@/lib/safe-url";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "";

function decryptToken(encrypted: string): string {
  if (!encrypted.startsWith("enc:") || !ENCRYPTION_KEY) return encrypted;
  try {
    const parts = encrypted.slice(4).split(":");
    if (parts.length !== 3) return encrypted;
    const [ivHex, ctHex, tagHex] = parts;
    const key = crypto.scryptSync(ENCRYPTION_KEY, "slack-token-salt", 32);
    const iv = Buffer.from(ivHex, "hex");
    const ct = Buffer.from(ctHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct).toString("utf8") + decipher.final("utf8");
  } catch {
    return encrypted;
  }
}

/**
 * POST /api/enterprise/integrations/[type]/test
 * Sends a test notification to the configured Slack workspace or Teams channel.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;

  const integration = await prisma.notificationIntegration.findUnique({
    where: { userId_type: { userId: session.user.id, type } },
  });
  if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });

  try {
    if (type === "slack") {
      if (!integration.accessToken || !integration.channelId) {
        return NextResponse.json({ error: "Slack not fully configured" }, { status: 400 });
      }
      const token = decryptToken(integration.accessToken);
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          channel: integration.channelId,
          text: "✅ *Cascrow test notification* — your Slack integration is working correctly.",
        }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? "Slack API error");
    } else if (type === "teams") {
      if (!integration.webhookUrl) {
        return NextResponse.json({ error: "Teams webhook URL not configured" }, { status: 400 });
      }
      if (!isValidTeamsWebhookUrl(integration.webhookUrl)) {
        return NextResponse.json({ error: "Stored webhook URL is invalid" }, { status: 400 });
      }
      const res = await fetch(integration.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          summary: "Cascrow test notification",
          themeColor: "C4704B",
          sections: [{ activityTitle: "✅ Cascrow test notification", activityText: "Your Microsoft Teams integration is working correctly." }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test failed" },
      { status: 500 }
    );
  }
}
