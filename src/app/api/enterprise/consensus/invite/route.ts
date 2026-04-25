import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEnterpriseContext } from "@/lib/enterprise-context";
import { sendConsensusVoteInviteEmail } from "@/lib/email";
import crypto from "crypto";

const VALID_ROLES = ["AUDITOR", "REGULATOR", "INVESTOR", "COMMITTEE"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  if (!(await checkRateLimit(`consensus-invite:${auth.userId}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null) as {
    milestoneId: string;
    partyEmail: string;
    partyRole: string;
    consensusDeadline: string;
    consensusThreshold?: number;
  } | null;

  if (!body?.milestoneId || !body?.partyEmail || !body?.partyRole || !body?.consensusDeadline) {
    return NextResponse.json({ error: "milestoneId, partyEmail, partyRole, consensusDeadline are required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(body.partyRole)) {
    return NextResponse.json({ error: `partyRole must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.partyEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const deadline = new Date(body.consensusDeadline);
  if (isNaN(deadline.getTime()) || deadline <= new Date()) {
    return NextResponse.json({ error: "consensusDeadline must be a future date" }, { status: 400 });
  }

  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const milestone = await prisma.milestone.findUnique({
    where: { id: body.milestoneId },
    include: { contract: { select: { investorId: true, mode: true, milestone: true, id: true } } },
  });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  if (milestone.contract.investorId !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (milestone.contract.mode !== "ATTESTATION") return NextResponse.json({ error: "Not an attestation milestone" }, { status: 400 });

  // Check for existing pending vote for this party
  const existing = await prisma.consensusVote.findFirst({
    where: { milestoneId: body.milestoneId, partyEmail: body.partyEmail, tokenUsed: false, tokenExpiry: { gt: new Date() } },
  });
  if (existing) {
    return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 409 });
  }

  const token = crypto.randomUUID();
  const threshold = body.consensusThreshold ?? milestone.consensusThreshold ?? 2;

  await Promise.all([
    prisma.consensusVote.create({
      data: {
        milestoneId: body.milestoneId,
        partyEmail: body.partyEmail,
        partyRole: body.partyRole,
        token,
        tokenExpiry: deadline,
      },
    }),
    prisma.milestone.update({
      where: { id: body.milestoneId },
      data: {
        consensusEnabled: true,
        consensusThreshold: threshold,
        consensusDeadline: deadline,
        consensusStatus: "AWAITING_VOTES",
      },
    }),
  ]);

  await sendConsensusVoteInviteEmail({
    to: body.partyEmail,
    milestoneTitle: milestone.title,
    contractId: milestone.contract.id,
    partyRole: body.partyRole,
    voteToken: token,
    deadline,
  }).catch(() => {/* silent fail if email not configured */});

  return NextResponse.json({ ok: true });
}
