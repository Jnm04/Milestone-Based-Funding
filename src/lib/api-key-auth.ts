import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface ApiKeyContext {
  userId: string;
  keyId: string;
}

export interface AuthContext {
  userId: string;
  isEnterprise: boolean;
}

/**
 * Resolves a cascrow API key from the Authorization header.
 * Accepts: Authorization: Bearer csk_<hex>
 * Returns null if the header is missing, malformed, or the key is inactive/unknown.
 * Updates lastUsedAt asynchronously on success.
 */
export async function resolveApiKey(authHeader: string | null): Promise<ApiKeyContext | null> {
  if (!authHeader?.startsWith("Bearer csk_")) return null;

  const rawKey = authHeader.slice(7); // strip "Bearer "
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, active: true },
  });

  if (!key?.active) return null;

  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { userId: key.userId, keyId: key.id };
}

/**
 * Resolves auth from either a NextAuth session or a cascrow API key.
 * Returns { userId, isEnterprise } or null if neither is valid.
 *
 * Usage:
 *   const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
 *   if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
 */
export async function resolveAuth(
  authHeader: string | null,
  sessionUser: { id: string; isEnterprise?: boolean | null } | null | undefined
): Promise<AuthContext | null> {
  if (sessionUser?.id) {
    return { userId: sessionUser.id, isEnterprise: sessionUser.isEnterprise ?? false };
  }

  const ctx = await resolveApiKey(authHeader);
  if (!ctx) return null;

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { isEnterprise: true },
  });

  return { userId: ctx.userId, isEnterprise: user?.isEnterprise ?? false };
}
