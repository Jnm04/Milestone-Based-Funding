import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpointId = request.nextUrl.searchParams.get("endpointId");
  if (!endpointId) return NextResponse.json({ error: "endpointId is required" }, { status: 400 });

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
    select: { userId: true },
  });
  if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (endpoint.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, event: true, statusCode: true, success: true, responseMs: true, createdAt: true },
  });

  return NextResponse.json({ deliveries });
}
