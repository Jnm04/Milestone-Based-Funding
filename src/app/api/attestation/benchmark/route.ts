/**
 * GET /api/attestation/benchmark?milestoneId=xxx
 * Feature V: Opt-In Peer Benchmarking
 *
 * Returns the industry percentile for a milestone's verified attestation rate,
 * compared to other milestones with the same benchmarkSector that opted in.
 *
 * Privacy guarantees:
 * - Raw data from other milestones is NEVER exposed — only pre-computed percentile
 * - Requires both the requesting milestone AND at least 5 peer milestones to have opted in
 * - Returns null if not enough peers to maintain anonymity
 * - The requesting user must own the contract containing the milestone
 *
 * POST /api/attestation/benchmark (toggle benchmarkOptIn for a milestone)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const MIN_PEERS_FOR_PRIVACY = 5;

const toggleSchema = z.object({
  milestoneId: z.string().min(1).max(50),
  benchmarkOptIn: z.boolean(),
  benchmarkSector: z.enum([
    "MANUFACTURING", "TECH", "FINANCE", "ENERGY",
    "HEALTHCARE", "RETAIL", "OTHER",
  ]).optional(),
});

/** Compute pass-rate (YES / total_runs) for a milestone's attestation entries. */
async function getPassRate(milestoneId: string): Promise<number | null> {
  const entries = await prisma.attestationEntry.findMany({
    where: { milestoneId, type: "PLATFORM" },
    select: { aiVerdict: true },
  });
  if (entries.length === 0) return null;
  const yes = entries.filter((e) => e.aiVerdict === "YES").length;
  return yes / entries.length;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const milestoneId = req.nextUrl.searchParams.get("milestoneId");
  if (!milestoneId) {
    return NextResponse.json({ error: "milestoneId is required" }, { status: 400 });
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { investorId: true, mode: true } } },
  });

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (milestone.contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (milestone.contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Benchmarking only available for attestation milestones" }, { status: 400 });
  }

  if (!milestone.benchmarkOptIn) {
    return NextResponse.json({
      benchmarkOptIn: false,
      message: "Opt in to benchmarking to see your industry percentile.",
    });
  }

  if (!milestone.benchmarkSector) {
    return NextResponse.json({
      benchmarkOptIn: true,
      percentile: null,
      message: "Set your sector to enable peer comparison.",
    });
  }

  // Get own pass rate
  const ownRate = await getPassRate(milestoneId);
  if (ownRate === null) {
    return NextResponse.json({
      benchmarkOptIn: true,
      percentile: null,
      message: "Complete at least one attestation run to see your percentile.",
    });
  }

  // Get all opted-in peers in the same sector (excluding self)
  const peers = await prisma.milestone.findMany({
    where: {
      benchmarkOptIn: true,
      benchmarkSector: milestone.benchmarkSector,
      id: { not: milestoneId },
      contract: { mode: "ATTESTATION" },
    },
    select: { id: true },
  });

  if (peers.length < MIN_PEERS_FOR_PRIVACY) {
    return NextResponse.json({
      benchmarkOptIn: true,
      percentile: null,
      sector: milestone.benchmarkSector,
      message: `Not enough peers in ${milestone.benchmarkSector} yet to compute a reliable percentile. Check back when more companies join.`,
      peerCount: peers.length,
    });
  }

  // Compute pass rates for all peers — server-side only, never exposed
  const peerRates = (
    await Promise.all(peers.map((p) => getPassRate(p.id)))
  ).filter((r): r is number => r !== null);

  if (peerRates.length < MIN_PEERS_FOR_PRIVACY) {
    return NextResponse.json({
      benchmarkOptIn: true,
      percentile: null,
      sector: milestone.benchmarkSector,
      message: "Not enough peer attestation data yet for a reliable comparison.",
    });
  }

  // Percentile: fraction of peers with a lower pass rate
  const belowCount = peerRates.filter((r) => r < ownRate).length;
  const percentile = Math.round((belowCount / peerRates.length) * 100);

  // Derive a human-readable label
  let label: string;
  if (percentile >= 90) label = "Top 10%";
  else if (percentile >= 75) label = `Top ${100 - percentile}%`;
  else if (percentile >= 50) label = "Above median";
  else if (percentile >= 25) label = "Below median";
  else label = `Bottom ${percentile + 10}%`;

  return NextResponse.json({
    benchmarkOptIn: true,
    percentile,
    label,
    sector: milestone.benchmarkSector,
    ownPassRate: Math.round(ownRate * 100),
    peerCount: peerRates.length,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { milestoneId, benchmarkOptIn, benchmarkSector } = parsed.data;

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: { contract: { select: { investorId: true, mode: true } } },
  });

  if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (milestone.contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (milestone.contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Benchmarking only available for attestation milestones" }, { status: 400 });
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      benchmarkOptIn,
      benchmarkSector: benchmarkSector ?? milestone.benchmarkSector,
    },
    select: { id: true, benchmarkOptIn: true, benchmarkSector: true },
  });

  return NextResponse.json({ success: true, milestone: updated });
}
