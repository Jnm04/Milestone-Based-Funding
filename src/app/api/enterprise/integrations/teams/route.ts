import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isValidTeamsWebhookUrl } from "@/lib/safe-url";

/**
 * POST /api/enterprise/integrations/teams
 * Saves a Microsoft Teams incoming webhook URL.
 *
 * GET /api/enterprise/integrations/teams
 * Returns the current Teams integration config for this user.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const integration = await prisma.notificationIntegration.findUnique({
    where: { userId_type: { userId: session.user.id, type: "teams" } },
    select: { id: true, channelName: true, events: true, createdAt: true },
  });

  return NextResponse.json({ integration });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ALLOWED_EVENTS = new Set(["attestation.completed", "attestation.failed", "deadline.approaching", "connector.error"]);
  const body = await request.json() as { webhookUrl?: string; channelName?: string; events?: string[] };

  if (!body.webhookUrl || !isValidTeamsWebhookUrl(body.webhookUrl)) {
    return NextResponse.json({ error: "A valid Microsoft Teams webhook URL is required" }, { status: 400 });
  }

  const events = (body.events ?? ["attestation.completed", "attestation.failed", "deadline.approaching"])
    .filter((e) => ALLOWED_EVENTS.has(e));
  if (body.channelName && body.channelName.length > 80) {
    return NextResponse.json({ error: "Channel name too long" }, { status: 400 });
  }

  const integration = await prisma.notificationIntegration.upsert({
    where: { userId_type: { userId: session.user.id, type: "teams" } },
    create: {
      userId: session.user.id,
      type: "teams",
      webhookUrl: body.webhookUrl,
      channelName: body.channelName?.slice(0, 80) ?? "Teams",
      events,
    },
    update: {
      webhookUrl: body.webhookUrl,
      channelName: body.channelName?.slice(0, 80) ?? "Teams",
      events,
    },
  });

  return NextResponse.json({ integration });
}
