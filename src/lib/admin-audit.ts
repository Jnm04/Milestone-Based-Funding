import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function logAdminAction(
  req: NextRequest,
  action: string,
  targetType: string,
  targetId: string,
  before?: unknown,
  after?: unknown
) {
  const adminIdent =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminIdent,
        action,
        targetType,
        targetId,
        before: before != null ? (before as Parameters<typeof prisma.adminAuditLog.create>[0]["data"]["before"]) : undefined,
        after: after != null ? (after as Parameters<typeof prisma.adminAuditLog.create>[0]["data"]["after"]) : undefined,
      },
    });
  } catch (err) {
    console.error("[admin-audit] Failed to log action:", err);
  }
}
