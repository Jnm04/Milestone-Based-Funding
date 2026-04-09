import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

/**
 * POST /api/telegram/setup-webhook
 * One-time call to register the bot's webhook URL with Telegram.
 * Must be called after deploying and setting TELEGRAM_BOT_TOKEN + TELEGRAM_WEBHOOK_SECRET.
 * Only accessible to authenticated users (admin action — call once from the profile page).
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!token) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 503 });
  if (!secret) return NextResponse.json({ error: "TELEGRAM_WEBHOOK_SECRET not set" }, { status: 503 });
  if (!baseUrl) return NextResponse.json({ error: "NEXTAUTH_URL not set" }, { status: 503 });

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: data.description ?? "Telegram API error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, webhookUrl });
}
