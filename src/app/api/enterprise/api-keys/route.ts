import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { writeOrgAuditLog } from "@/lib/org-audit";

const MAX_KEYS = 10;

// ── GET /api/enterprise/api-keys ──────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, active: true },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

// ── POST /api/enterprise/api-keys ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "name is required (max 80 chars)" }, { status: 400 });
  }

  const count = await prisma.apiKey.count({ where: { userId: session.user.id, active: true } });
  if (count >= MAX_KEYS) {
    return NextResponse.json({ error: `Maximum ${MAX_KEYS} API keys per account` }, { status: 429 });
  }

  const rawKey = "csk_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const key = await prisma.apiKey.create({
    data: { userId: session.user.id, name, keyHash, keyPrefix },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "API_KEY_CREATED",
    detail: `API key "${name}" created`,
    meta: { keyName: name, keyPrefix },
  });

  return NextResponse.json({
    key,
    secret: rawKey,
    message: "Save this key now — it will not be shown again.",
  });
}
