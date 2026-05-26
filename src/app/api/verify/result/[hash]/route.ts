/**
 * GET /api/verify/result/[hash]
 * ==============================
 * Public endpoint — no auth required.
 * Returns the result of a standalone verification by its public hash.
 * Used by /verify/result/[hash] page to render the shareable report.
 *
 * Only returns non-sensitive fields (no userId, no codeText content).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;

  // Basic format check — SHA-256 hex is exactly 64 chars
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }

  // Light rate limit — public endpoint
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`verify-result:${ip}`, 60, 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const record = await prisma.standaloneVerification.findUnique({
    where: { publicHash: hash },
    select: {
      id: true,
      taskDescription: true,
      prUrl: true,
      decision: true,
      confidence: true,
      result: true,
      status: true,
      checklistItems: true,
      createdAt: true,
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Verification not found" }, { status: 404 });
  }

  return NextResponse.json(record, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
