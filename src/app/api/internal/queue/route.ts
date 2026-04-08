import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { labelQueueEntry } from "@/services/brain/training.service";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  return key === process.env.INTERNAL_SECRET;
}

/** GET — list all pending human review entries */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.humanReviewQueue.findMany({
    where: { reviewedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return NextResponse.json({ entries });
}

/** POST — label a queue entry */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proofId, label, fraudType, notes } = await req.json();
  if (!proofId || !label) {
    return NextResponse.json({ error: "proofId and label required" }, { status: 400 });
  }
  if (!["APPROVED", "REJECTED", "FAKED"].includes(label)) {
    return NextResponse.json({ error: "label must be APPROVED, REJECTED, or FAKED" }, { status: 400 });
  }

  await labelQueueEntry({ proofId, label, fraudType, notes });
  return NextResponse.json({ ok: true });
}
