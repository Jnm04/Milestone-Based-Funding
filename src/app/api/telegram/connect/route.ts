import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

/**
 * POST /api/telegram/connect
 * Generates a short-lived deep-link token (15 min) and returns the bot link.
 * The user opens t.me/BotUsername?start=<token> → bot calls /api/telegram/webhook.
 *
 * GET /api/telegram/connect
 * Returns the user's current Telegram connection status.
 *
 * DELETE /api/telegram/connect
 * Disconnects the Telegram chat.
 */

const BOT_USERNAME = () => process.env.TELEGRAM_BOT_USERNAME ?? "";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Rate limit: 10 token generations per user per hour
  if (!(await checkRateLimit(`telegram-connect:${session.user.id}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  const botUsername = BOT_USERNAME();
  if (!botUsername) {
    return NextResponse.json(
      { error: "Telegram bot is not configured (TELEGRAM_BOT_USERNAME missing)" },
      { status: 503 }
    );
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Upsert: create row if first time connecting, update token if reconnecting
    await prisma.telegramChat.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        chatId: "", // filled in by /api/telegram/webhook
        connectToken: token,
        connectTokenExpiry: expiry,
        active: false,
      },
      update: {
        connectToken: token,
        connectTokenExpiry: expiry,
      },
    });

    const deepLink = `https://t.me/${botUsername}?start=${token}`;
    return NextResponse.json({ deepLink, expiresInMinutes: 15 });
  } catch (err) {
    console.error("[telegram/connect] POST failed:", err);
    return NextResponse.json({ error: "Failed to generate connect link" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const chat = await prisma.telegramChat.findUnique({
      where: { userId: session.user.id },
      select: { active: true, createdAt: true },
    });

    return NextResponse.json({
      configured: !!BOT_USERNAME(),
      connected: !!chat?.active,
      connectedAt: chat?.active ? chat.createdAt : null,
    });
  } catch (err) {
    console.error("[telegram/connect] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch Telegram status" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.telegramChat.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[telegram/connect] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to disconnect Telegram" }, { status: 500 });
  }
}
