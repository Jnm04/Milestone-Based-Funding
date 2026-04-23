import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";

export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) {
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
