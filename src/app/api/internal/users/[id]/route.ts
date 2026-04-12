import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { screenName } from "@/services/sanctions/sanctions.service";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

/** PATCH /api/internal/users/[id] — manually set kycTier */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { kycTier } = await request.json();
  if (typeof kycTier !== "number" || ![0, 1, 2, 3].includes(kycTier)) {
    return NextResponse.json({ error: "kycTier must be 0, 1, 2, or 3" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { kycTier },
    select: { id: true, kycTier: true },
  });

  return NextResponse.json({ user });
}

/** POST /api/internal/users/[id]/recheck — run sanctions screening for a specific user */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, dateOfBirth: true, kycTier: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const target = user.name ?? user.email.split("@")[0];
  const result = await screenName(target, user.dateOfBirth ?? null);

  const newTier = result.hit ? user.kycTier : Math.max(user.kycTier, 1);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      sanctionsCheckedAt: new Date(),
      sanctionsStatus: result.hit ? "HIT" : "CLEAR",
      kycTier: newTier,
    },
    select: { id: true, sanctionsStatus: true, kycTier: true },
  });

  return NextResponse.json({ user: updated });
}
