import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_MILESTONES = 50;
const MAX_TITLE_LEN = 200;
const MAX_DESC_LEN = 2000;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isEnterprise) {
    return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });
  }

  if (!(await checkRateLimit(`enterprise-create:${session.user.id}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before creating another goal set." },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
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
  if (title.trim().length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `Title must be ${MAX_TITLE_LEN} characters or fewer` }, { status: 400 });
  }
  if (!Array.isArray(milestones) || milestones.length === 0) {
    return NextResponse.json({ error: "At least one milestone is required" }, { status: 400 });
  }
  if (milestones.length > MAX_MILESTONES) {
    return NextResponse.json({ error: `A goal set can have at most ${MAX_MILESTONES} milestones` }, { status: 400 });
  }
  for (const m of milestones) {
    if (!m.title || typeof m.title !== "string" || !m.title.trim()) {
      return NextResponse.json({ error: "Each milestone must have a title" }, { status: 400 });
    }
    if (m.title.trim().length > MAX_TITLE_LEN) {
      return NextResponse.json({ error: `Milestone title must be ${MAX_TITLE_LEN} characters or fewer` }, { status: 400 });
    }
    if (m.description && typeof m.description === "string" && m.description.trim().length > MAX_DESC_LEN) {
      return NextResponse.json({ error: `Milestone description must be ${MAX_DESC_LEN} characters or fewer` }, { status: 400 });
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
