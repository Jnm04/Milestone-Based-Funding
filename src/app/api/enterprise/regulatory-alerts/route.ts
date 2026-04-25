import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(request.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  if (!(await checkRateLimit(`enterprise-reg-alerts:${auth.userId}`, 60, 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const tag = request.nextUrl.searchParams.get("tag");

  const alerts = await prisma.regulatoryAlert.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const filtered = tag
    ? alerts.filter((a) => {
        const tags = a.affectedTags as string[];
        return tags.some((t) => t.startsWith(tag));
      })
    : alerts;

  return NextResponse.json({ alerts: filtered });
}
