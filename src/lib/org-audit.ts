import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function writeOrgAuditLog(opts: {
  orgId: string;
  actorId?: string | null;
  action: string;
  detail?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.orgAuditLog.create({
      data: {
        orgId: opts.orgId,
        actorId: opts.actorId ?? null,
        action: opts.action,
        detail: opts.detail ?? null,
        meta: opts.meta ? (opts.meta as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  } catch {
    // Non-fatal — never let audit logging break the main request
  }
}
