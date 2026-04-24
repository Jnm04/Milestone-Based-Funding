import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInternalAuthorized } from "@/lib/internal-auth";

/**
 * POST /api/internal/auditor-partners
 * Admin creates an AuditorPartner record for an existing user.
 *
 * GET /api/internal/auditor-partners
 * Lists all registered auditor partners.
 */
export async function GET(request: NextRequest) {
  if (!isInternalAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partners = await prisma.auditorPartner.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ partners });
}

export async function POST(request: NextRequest) {
  if (!isInternalAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { email?: string; firmName?: string };
  if (!body.email || !body.firmName) {
    return NextResponse.json({ error: "email and firmName are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.auditorPartner.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ error: "Already an auditor partner" }, { status: 409 });

  const partner = await prisma.auditorPartner.create({
    data: { userId: user.id, firmName: body.firmName.trim() },
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json({ partner }, { status: 201 });
}
