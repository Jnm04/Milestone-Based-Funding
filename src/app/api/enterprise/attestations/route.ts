import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isEnterprise) {
    return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  }

  let body: { title: string; milestones: { title: string; description?: string; deadline: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, milestones } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
  }
  for (const m of milestones) {
    if (!m.title || typeof m.title !== "string" || !m.title.trim()) {
      return NextResponse.json({ error: "Each milestone must have a title" }, { status: 400 });
    }
    if (!m.deadline || isNaN(new Date(m.deadline).getTime())) {
      return NextResponse.json({ error: "Each milestone must have a valid deadline" }, { status: 400 });
    }
  }

  const maxDeadline = milestones.reduce((max, m) => {
    const d = new Date(m.deadline);
    return d > max ? d : max;
  }, new Date(milestones[0].deadline));

  const contract = await prisma.contract.create({
    data: {
      investorId: session.user.id,
      startupId: session.user.id,
      milestone: title.trim(),
      amountUSD: 0,
      status: "FUNDED",
      mode: "ATTESTATION",
      cancelAfter: maxDeadline,
      milestones: {
        create: milestones.map((m, index) => ({
          title: m.title.trim(),
          description: m.description?.trim() || null,
          amountUSD: 0,
          status: "FUNDED",
          order: index + 1,
          cancelAfter: new Date(m.deadline),
        })),
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ id: contract.id });
}
