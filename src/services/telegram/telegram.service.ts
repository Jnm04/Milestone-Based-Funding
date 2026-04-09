/**
 * Telegram Notification Service
 * ==============================
 * Sends Markdown-formatted messages to users via a Telegram bot.
 *
 * Setup (one-time):
 *  1. Create a bot via @BotFather → get TELEGRAM_BOT_TOKEN.
 *  2. Set the webhook URL: POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *     body: { url: "https://your-domain/api/telegram/webhook" }
 *     (Done automatically by /api/telegram/setup-webhook when the app starts on Vercel.)
 *
 * User connection flow:
 *  1. User clicks "Connect Telegram" in their profile settings.
 *  2. POST /api/telegram/connect → generates a 32-byte token + a deep-link URL.
 *  3. User opens t.me/YourBot?start=<token> → bot receives /start <token>.
 *  4. POST /api/telegram/webhook → verifies token, stores chatId, clears token.
 *  5. All subsequent notifications go directly to the user's Telegram chat.
 *
 * Security:
 *  - Connection tokens are 32-byte random hex strings, expire in 15 minutes.
 *  - Webhook requests from Telegram are validated via a secret token in the
 *    X-Telegram-Bot-Api-Secret-Token header.
 *  - No private key or wallet data is ever sent over Telegram.
 *
 * Never throws — all errors are logged and swallowed.
 */

import { prisma } from "@/lib/prisma";

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const API_BASE = () => `https://api.telegram.org/bot${BOT_TOKEN()}`;

// ─── Low-level send ────────────────────────────────────────────────────────────

/**
 * Send a plain-text or MarkdownV2 message to a Telegram chat.
 * Returns true if the request succeeded, false otherwise.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: "MarkdownV2" | "HTML" | "" = "HTML"
): Promise<boolean> {
  if (!BOT_TOKEN()) return false;
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    };
    if (parseMode) body.parse_mode = parseMode;

    const res = await fetch(`${API_BASE()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[telegram] sendMessage failed (${res.status}): ${err}`);
    }
    return res.ok;
  } catch (err) {
    console.warn("[telegram] sendMessage error (non-fatal):", err);
    return false;
  }
}

// ─── Notify by userId ──────────────────────────────────────────────────────────

/**
 * Look up the user's connected Telegram chat and send a message.
 * No-ops silently if the user has no Telegram chat or it is inactive.
 */
export async function notifyUser(userId: string, html: string): Promise<void> {
  try {
    const chat = await prisma.telegramChat.findUnique({
      where: { userId },
      select: { chatId: true, active: true },
    });
    if (!chat || !chat.active) return;
    await sendTelegramMessage(chat.chatId, html, "HTML");
  } catch (err) {
    console.warn("[telegram] notifyUser error (non-fatal):", err);
  }
}

// ─── High-level notification helpers ─────────────────────────────────────────

const BASE_URL = () =>
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

function contractLink(contractId: string) {
  return `${BASE_URL()}/contract/${contractId}`;
}

export async function tgProofSubmitted(params: {
  investorId: string;
  contractId: string;
  milestoneTitle: string;
  startupName?: string | null;
}) {
  const { investorId, contractId, milestoneTitle, startupName } = params;
  const name = esc(startupName ?? "The Receiver");
  const ms = esc(milestoneTitle);
  await notifyUser(
    investorId,
    `📄 <b>Proof submitted</b>\n\n${name} submitted proof for milestone <b>${ms}</b>.\n\nAI verification is running automatically.\n\n<a href="${contractLink(contractId)}">Open contract →</a>`
  );
}

export async function tgPendingReview(params: {
  investorId: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
}) {
  const { investorId, contractId, milestoneTitle, aiReasoning } = params;
  const ms = esc(milestoneTitle);
  const reasoning = aiReasoning ? `\n\n<i>AI: ${esc(aiReasoning.slice(0, 200))}</i>` : "";
  await notifyUser(
    investorId,
    `⚠️ <b>Manual review required</b>\n\nAI is uncertain about <b>${ms}</b>. Your decision is needed.${reasoning}\n\n<a href="${contractLink(contractId)}">Review now →</a>`
  );
}

export async function tgMilestoneCompleted(params: {
  investorId: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
}) {
  const { investorId, contractId, milestoneTitle, amountUSD } = params;
  const ms = esc(milestoneTitle);
  const amount = esc(`$${Number(amountUSD).toLocaleString()}`);
  await notifyUser(
    investorId,
    `✅ <b>Milestone completed</b>\n\n<b>${ms}</b> is done. <b>${amount} RLUSD</b> released.\n\n<a href="${contractLink(contractId)}">View contract →</a>`
  );
}

export async function tgFunded(params: {
  startupId: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
}) {
  const { startupId, contractId, milestoneTitle, amountUSD } = params;
  const ms = esc(milestoneTitle);
  const amount = esc(`$${Number(amountUSD).toLocaleString()}`);
  await notifyUser(
    startupId,
    `💰 <b>Milestone funded</b>\n\n<b>${ms}</b> has been funded with <b>${amount} RLUSD</b>.\n\nYou can now upload proof to trigger the release.\n\n<a href="${contractLink(contractId)}">Upload proof →</a>`
  );
}

export async function tgVerified(params: {
  startupId: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  txHash?: string | null;
}) {
  const { startupId, contractId, milestoneTitle, amountUSD, txHash } = params;
  const ms = esc(milestoneTitle);
  const amount = esc(`$${Number(amountUSD).toLocaleString()}`);
  const tx = txHash ? `\n\nTx: <code>${esc(txHash)}</code>` : "";
  await notifyUser(
    startupId,
    `🎉 <b>Payment released!</b>\n\nYour proof for <b>${ms}</b> was approved. <b>${amount} RLUSD</b> is on its way.${tx}\n\n<a href="${contractLink(contractId)}">View contract →</a>`
  );
}

export async function tgRejected(params: {
  startupId: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
}) {
  const { startupId, contractId, milestoneTitle, aiReasoning } = params;
  const ms = esc(milestoneTitle);
  const reason = aiReasoning ? `\n\n<b>Reason:</b> ${esc(aiReasoning.slice(0, 300))}` : "";
  await notifyUser(
    startupId,
    `❌ <b>Proof rejected</b>\n\nYour proof for <b>${ms}</b> was rejected.${reason}\n\nYou can resubmit before the deadline.\n\n<a href="${contractLink(contractId)}">Resubmit →</a>`
  );
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Bot webhook registration ─────────────────────────────────────────────────

/**
 * Register the Telegram webhook URL with the Bot API.
 * Call this once after deploying to Vercel (or on every cold start — it's idempotent).
 */
export async function registerTelegramWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_TOKEN()) return;
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    const res = await fetch(`${API_BASE()}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        secret_token: secretToken,
        drop_pending_updates: true,
      }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      console.warn("[telegram] setWebhook failed:", data.description);
    } else {
      console.log("[telegram] Webhook registered:", webhookUrl);
    }
  } catch (err) {
    console.warn("[telegram] registerTelegramWebhook error (non-fatal):", err);
  }
}
