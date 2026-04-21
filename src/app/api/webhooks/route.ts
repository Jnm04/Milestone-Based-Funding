import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { WEBHOOK_EVENTS } from "@/services/webhook/webhook.service";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";

const MAX_ENDPOINTS_PER_USER = 10;

function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  if (net.isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIP(v) === 6) {
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true;
    if (v.startsWith("fe80")) return true;
    return false;
  }
  return false;
}

/**
 * Rejects URLs that resolve to private/internal network ranges to prevent SSRF.
 * DNS-resolves the hostname so attacker-controlled domains pointing at RFC 1918
 * space are also blocked.
 */
async function isPrivateUrl(urlStr: string): Promise<boolean> {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (protocol !== "https:") return true;
    if (/^(localhost|0\.0\.0\.0)$/i.test(hostname)) return true;
    if (/\.(local|internal|localhost|intranet)$/i.test(hostname)) return true;
    if (net.isIP(hostname)) return isPrivateIp(hostname);
    try {
      const addrs = await dns.lookup(hostname, { all: true });
      for (const a of addrs) {
        if (isPrivateIp(a.address)) return true;
      }
    } catch {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

// ─── GET /api/webhooks ────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: session.user.id },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      endpoints: endpoints.map((ep) => ({
        ...ep,
        events: safeParseEvents(ep.events),
      })),
      availableEvents: WEBHOOK_EVENTS,
    });
  } catch (err) {
    console.error("[webhooks] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// ─── POST /api/webhooks ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { url, events } = body as { url?: unknown; events?: unknown };

  // Validate URL
  if (typeof url !== "string" || !url.startsWith("https://")) {
    return NextResponse.json(
      { error: "url must be a valid HTTPS URL" },
      { status: 400 }
    );
  }
  if (url.length > 500) {
    return NextResponse.json({ error: "url too long" }, { status: 400 });
  }
  if (await isPrivateUrl(url)) {
    return NextResponse.json(
      { error: "Webhook URL must point to a public internet address" },
      { status: 400 }
    );
  }

  // Validate events
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { error: "events must be a non-empty array" },
      { status: 400 }
    );
  }
  const validEvents = new Set<string>(WEBHOOK_EVENTS);
  const invalid = (events as unknown[]).filter(
    (e) => typeof e !== "string" || (!validEvents.has(e) && e !== "*")
  );
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown events: ${invalid.join(", ")}. Valid: ${WEBHOOK_EVENTS.join(", ")}` },
      { status: 400 }
    );
  }

  // Enforce per-user limit
  const count = await prisma.webhookEndpoint.count({
    where: { userId: session.user.id },
  });
  if (count >= MAX_ENDPOINTS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum ${MAX_ENDPOINTS_PER_USER} webhook endpoints per account` },
      { status: 429 }
    );
  }

  // Generate signing secret
  const secret = crypto.randomBytes(32).toString("hex");

  try {
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: session.user.id,
        url,
        secret,
        events: JSON.stringify(events),
      },
      select: { id: true, url: true, events: true, active: true, createdAt: true },
    });

    return NextResponse.json({
      endpoint: { ...endpoint, events: safeParseEvents(endpoint.events) },
      // Secret is returned ONCE at creation — never retrievable again
      secret,
      message:
        "Save the secret now — it is shown only once. Use it to verify the X-Cascrow-Signature header on incoming requests.",
    });
  } catch (err) {
    console.error("[webhooks] POST failed:", err);
    return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
  }
}

// ─── DELETE /api/webhooks?id=xxx ──────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (endpoint.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.webhookEndpoint.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhooks] DELETE failed:", err);
    return NextResponse.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}

// ─── PATCH /api/webhooks?id=xxx  (toggle active) ─────────────────────────────

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  try {
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (endpoint.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: { active?: boolean; events?: string } = {};
    if (typeof body.active === "boolean") updates.active = body.active;
    if (Array.isArray(body.events)) {
      const validEvents = new Set<string>(WEBHOOK_EVENTS);
      const invalid = (body.events as unknown[]).filter(
        (e) => typeof e !== "string" || (!validEvents.has(e) && e !== "*")
      );
      if (invalid.length > 0) {
        return NextResponse.json({ error: `Unknown events: ${invalid.join(", ")}` }, { status: 400 });
      }
      updates.events = JSON.stringify(body.events);
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: updates,
      select: { id: true, url: true, events: true, active: true, createdAt: true },
    });

    return NextResponse.json({
      endpoint: { ...updated, events: safeParseEvents(updated.events) },
    });
  } catch (err) {
    console.error("[webhooks] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}

// ─── PUT /api/webhooks?id=xxx  (regenerate signing secret) ───────────────────

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (endpoint.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newSecret = crypto.randomBytes(32).toString("hex");
    await prisma.webhookEndpoint.update({ where: { id }, data: { secret: newSecret } });

    return NextResponse.json({
      secret: newSecret,
      message: "Secret regenerated. Save it now — it will not be shown again.",
    });
  } catch (err) {
    console.error("[webhooks] PUT failed:", err);
    return NextResponse.json({ error: "Failed to regenerate secret" }, { status: 500 });
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeParseEvents(raw: string): string[] {
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
