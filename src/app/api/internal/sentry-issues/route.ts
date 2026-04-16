import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  if (!key || !secret) return false;
  try {
    const len = Math.max(key.length, secret.length);
    const a = Buffer.alloc(len);
    const b = Buffer.alloc(len);
    Buffer.from(key).copy(a);
    Buffer.from(secret).copy(b);
    return key.length === secret.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!token || !org || !project) {
    return NextResponse.json({ error: "Sentry not configured", issues: [] });
  }

  try {
    const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?limit=25&query=is:unresolved&sort=date`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Sentry API error: ${res.status}`, issues: [] });
    }

    const issues = await res.json();
    return NextResponse.json({ issues });
  } catch (err) {
    console.error("[sentry-issues]", err);
    return NextResponse.json({ error: "Failed to fetch Sentry issues", issues: [] });
  }
}
