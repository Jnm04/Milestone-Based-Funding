import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ type: string }> };

/**
 * GET /api/enterprise/integrations/[type]
 * Returns integration config (slack or teams) for the current user.
 *
 * DELETE /api/enterprise/integrations/[type]
 * Disconnects the integration.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;
  if (!["slack", "teams"].includes(type)) {
    return NextResponse.json({ error: "Unknown integration type" }, { status: 400 });
  }

  const integration = await prisma.notificationIntegration.findUnique({
    where: { userId_type: { userId: session.user.id, type } },
    select: { id: true, type: true, channelId: true, channelName: true, events: true, createdAt: true },
  });

  return NextResponse.json({ integration });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;
  const body = await request.json() as { events?: string[] };

  const integration = await prisma.notificationIntegration.findUnique({
    where: { userId_type: { userId: session.user.id, type } },
  });
  if (!integration) return NextResponse.json({ error: "Not connected" }, { status: 404 });

  const updated = await prisma.notificationIntegration.update({
    where: { id: integration.id },
    data: { events: body.events },
  });

  return NextResponse.json({ integration: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await params;

  await prisma.notificationIntegration.deleteMany({
    where: { userId: session.user.id, type },
  });

  return NextResponse.json({ ok: true });
}
