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

async function sendSlackMessage(accessToken: string, channelId: string, text: string) {
  const token = decryptToken(accessToken);
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel: channelId, text }),
  });
  const data = await res.json() as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack API: ${data.error}`);
}

async function sendTeamsMessage(webhookUrl: string, text: string, title: string) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      summary: title,
      themeColor: "C4704B",
      sections: [{ activityTitle: title, activityText: text }],
    }),
  });
  if (!res.ok) throw new Error(`Teams webhook: HTTP ${res.status}`);
}

/**
 * Fires a notification to all connected Slack / Teams integrations for a user
 * that subscribe to the given event.
 * Silent-fails — never throws.
 */
export async function fireIntegrationNotification(
  userId: string,
  event: string,
  message: string,
  title: string
) {
  try {
    const integrations = await prisma.notificationIntegration.findMany({
      where: { userId },
    });

    await Promise.allSettled(
      integrations.map(async (integration) => {
        const events = (integration.events as string[]) ?? [];
        if (!events.includes(event)) return;

        if (integration.type === "slack" && integration.accessToken && integration.channelId) {
          await sendSlackMessage(integration.accessToken, integration.channelId, `*${title}*\n${message}`);
        } else if (integration.type === "teams" && integration.webhookUrl && isValidTeamsWebhookUrl(integration.webhookUrl)) {
          await sendTeamsMessage(integration.webhookUrl, message, title);
        }
      })
    );
  } catch {
    // Silent-fail — notification failures must never break the main flow
  }
}
