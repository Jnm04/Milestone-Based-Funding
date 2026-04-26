import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendTeamInviteEmail } from "@/lib/email";
import { writeOrgAuditLog } from "@/lib/org-audit";

const MAX_MEMBERS = 20;

// ── GET /api/enterprise/team ──────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.orgMember.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      acceptedAt: true,
      createdAt: true,
      member: { select: { name: true } },
    },
  });

  return NextResponse.json({ members });
}

// ── POST /api/enterprise/team ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isEnterprise: true, name: true, companyName: true },
  });
  if (!user?.isEnterprise) return NextResponse.json({ error: "Enterprise account required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "EDITOR" ? "EDITOR" : "VIEWER";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (email === session.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const count = await prisma.orgMember.count({ where: { ownerId: session.user.id } });
  if (count >= MAX_MEMBERS) {
    return NextResponse.json({ error: `Maximum ${MAX_MEMBERS} team members` }, { status: 429 });
  }

  const inviteToken = crypto.randomBytes(24).toString("hex");
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const member = await prisma.orgMember.upsert({
    where: { ownerId_email: { ownerId: session.user.id, email } },
    update: { role, inviteToken, inviteExpiry, acceptedAt: null, memberId: null },
    create: { ownerId: session.user.id, email, role, inviteToken, inviteExpiry },
  });

  await sendTeamInviteEmail({
    to: email,
    inviterName: user.name ?? session.user.email ?? "A team admin",
    companyName: user.companyName ?? "their organization",
    role,
    inviteToken,
  }).catch(() => {});

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "MEMBER_INVITED",
    detail: `Invited ${email} as ${role}`,
    meta: { email, role },
  });

  return NextResponse.json({ member });
}

// ── PATCH /api/enterprise/team — change role of an existing member ────────────

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const role = body?.role === "EDITOR" ? "EDITOR" : body?.role === "VIEWER" ? "VIEWER" : null;

  if (!id || !role) return NextResponse.json({ error: "id and role required" }, { status: 400 });

  const member = await prisma.orgMember.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (member.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!member.acceptedAt) return NextResponse.json({ error: "Cannot change role of pending invite" }, { status: 400 });

  const updated = await prisma.orgMember.update({ where: { id }, data: { role } });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "MEMBER_ROLE_CHANGED",
    detail: `Changed ${member.email} role to ${role}`,
    meta: { email: member.email, previousRole: member.role, newRole: role },
  });

  return NextResponse.json({ member: updated });
}

// ── DELETE /api/enterprise/team?id=xxx ────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const member = await prisma.orgMember.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (member.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.orgMember.delete({ where: { id } });

  void writeOrgAuditLog({
    orgId: session.user.id,
    actorId: session.user.id,
    action: "MEMBER_REMOVED",
    detail: `Removed ${member.email} from team`,
    meta: { email: member.email, role: member.role },
  });

  return NextResponse.json({ ok: true });
}
