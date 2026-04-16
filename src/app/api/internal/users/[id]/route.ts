import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { screenName } from "@/services/sanctions/sanctions.service";
import { isInternalAuthorized } from "@/lib/internal-auth";

/** PATCH /api/internal/users/[id] — manually set kycTier */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isInternalAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { kycTier } = await request.json();
  if (typeof kycTier !== "number" || ![0, 1, 2, 3].includes(kycTier)) {
    return NextResponse.json({ error: "kycTier must be 0, 1, 2, or 3" }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { kycTier },
      select: { id: true, kycTier: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    console.error("[internal/users] PATCH failed:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** POST /api/internal/users/[id]/recheck — run sanctions screening for a specific user */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isInternalAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
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
  } catch (err) {
    console.error("[internal/users] POST recheck failed:", err);
    return NextResponse.json({ error: "Sanctions recheck failed" }, { status: 500 });
  }
}
