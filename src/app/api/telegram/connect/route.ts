import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
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

  const botUsername = BOT_USERNAME();
  if (!botUsername) {
    return NextResponse.json(
      { error: "Telegram bot is not configured (TELEGRAM_BOT_USERNAME missing)" },
      { status: 503 }
    );
  }

  const deepLink = `https://t.me/${botUsername}?start=${token}`;
  return NextResponse.json({ deepLink, expiresInMinutes: 15 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chat = await prisma.telegramChat.findUnique({
    where: { userId: session.user.id },
    select: { active: true, createdAt: true },
  });

  return NextResponse.json({
    connected: !!chat?.active,
    connectedAt: chat?.active ? chat.createdAt : null,
  });
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.telegramChat.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
