import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegramMessage } from "@/services/telegram/telegram.service";

/**
 * POST /api/telegram/webhook
 * Receives updates from the Telegram Bot API.
 * Handles:
 *  - /start <token>  — connect the user's Telegram account
 *  - /stop           — disconnect (deactivate) the chat
 *  - /status         — reply with current connection info
 *
 * Security: Telegram signs webhook requests with a secret token in the
 * X-Telegram-Bot-Api-Secret-Token header. We reject requests without it.
 */
export async function POST(request: NextRequest) {
  // Validate Telegram's secret token header
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (secretToken) {
    const incoming = request.headers.get("x-telegram-bot-api-secret-token");
    if (incoming !== secretToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  if (!message?.text || !message.chat?.id) {
    // Ignore non-text updates (photos, stickers, etc.)
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // ── /start <token> ────────────────────────────────────────────────────────
  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const token = parts[1]?.trim();

    if (!token) {
      await sendTelegramMessage(
        chatId,
        "👋 <b>Welcome to Cascrow!</b>\n\nTo connect your account, go to your <b>Profile → Telegram</b> in the Cascrow app and click \"Connect Telegram\".",
        "HTML"
      );
      return NextResponse.json({ ok: true });
    }

    // Look up the pending connect token
    const pending = await prisma.telegramChat.findUnique({
      where: { connectToken: token },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!pending) {
      await sendTelegramMessage(
        chatId,
        "❌ <b>Invalid or expired link.</b>\n\nPlease generate a new one from your Cascrow profile settings.",
        "HTML"
      );
      return NextResponse.json({ ok: true });
    }

    if (pending.connectTokenExpiry && pending.connectTokenExpiry < new Date()) {
      await sendTelegramMessage(
        chatId,
        "⏰ <b>This link has expired.</b>\n\nPlease generate a new one from your Cascrow profile settings.",
        "HTML"
      );
      return NextResponse.json({ ok: true });
    }

    // Activate the connection
    await prisma.telegramChat.update({
      where: { id: pending.id },
      data: {
        chatId,
        active: true,
        connectToken: null,
        connectTokenExpiry: null,
      },
    });

    const userName = pending.user.name ?? pending.user.email.split("@")[0];
    await sendTelegramMessage(
      chatId,
      `✅ <b>Connected!</b>\n\nHi <b>${esc(userName)}</b>, your Cascrow account is now connected. You'll receive notifications here for:\n\n• Milestone funded / proof submitted\n• AI verification results\n• Manual review requests\n• Funds released\n\nSend /stop at any time to disconnect.`,
      "HTML"
    );
    return NextResponse.json({ ok: true });
  }

  // ── /stop ─────────────────────────────────────────────────────────────────
  if (text === "/stop") {
    const count = await prisma.telegramChat.updateMany({
      where: { chatId, active: true },
      data: { active: false },
    });
    if (count.count > 0) {
      await sendTelegramMessage(
        chatId,
        "👋 <b>Disconnected.</b>\n\nYou will no longer receive Cascrow notifications here. Reconnect anytime from your profile settings.",
        "HTML"
      );
    } else {
      await sendTelegramMessage(chatId, "No active Cascrow connection found for this chat.", "HTML");
    }
    return NextResponse.json({ ok: true });
  }

  // ── /status ───────────────────────────────────────────────────────────────
  if (text === "/status") {
    const chat = await prisma.telegramChat.findFirst({
      where: { chatId, active: true },
      include: { user: { select: { email: true, role: true } } },
    });
    if (chat) {
      await sendTelegramMessage(
        chatId,
        `✅ <b>Connected</b>\n\nAccount: <code>${esc(chat.user.email)}</code>\nRole: ${chat.user.role}\n\nSend /stop to disconnect.`,
        "HTML"
      );
    } else {
      await sendTelegramMessage(
        chatId,
        "ℹ️ No active Cascrow connection. Use the link from your profile to connect.",
        "HTML"
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Unknown command — gentle help message
  await sendTelegramMessage(
    chatId,
    "Available commands:\n/status — check connection\n/stop — disconnect",
    "HTML"
  );
  return NextResponse.json({ ok: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id: number };
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
