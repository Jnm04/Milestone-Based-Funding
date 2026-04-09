import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { labelQueueEntry, undoLabelQueueEntry, skipQueueEntry } from "@/services/brain/training.service";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

/**
 * GET — list queue entries by tab:
 *   ?tab=pending  (default) — not reviewed, not skipped
 *   ?tab=reviewed           — already labeled by a human
 *   ?tab=skipped            — skipped by reviewer (not yet labeled)
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tab = req.nextUrl.searchParams.get("tab") ?? "pending";

  let where: Record<string, unknown>;
  if (tab === "reviewed") {
    where = { reviewedAt: { not: null } };
  } else if (tab === "skipped") {
    where = { skippedAt: { not: null }, reviewedAt: null };
  } else {
    where = { reviewedAt: null, skippedAt: null };
  }

  const entries = await prisma.humanReviewQueue.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json({ entries });
}

/** POST — label a queue entry (moves it to TrainingEntry) */
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

/** PATCH — mark entry as skipped (persisted, excluded from pending list) */
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proofId } = await req.json();
  if (!proofId) return NextResponse.json({ error: "proofId required" }, { status: 400 });

  await skipQueueEntry(proofId);
  return NextResponse.json({ ok: true });
}

/**
 * DELETE — undo the last label on an entry.
 * Removes the HUMAN TrainingEntry and resets the queue row back to pending.
 */
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { proofId } = await req.json();
  if (!proofId) return NextResponse.json({ error: "proofId required" }, { status: 400 });

  await undoLabelQueueEntry(proofId);
  return NextResponse.json({ ok: true });
}
