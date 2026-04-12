import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "50")), 200);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0"));

  const [total, entries] = await Promise.all([
    prisma.trainingEntry.count(),
    prisma.trainingEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        proofId: true,
        milestoneText: true,
        proofText: true,
        label: true,
        labelSource: true,
        consensusLevel: true,
        fraudType: true,
        modelVotes: true,
        notes: true,
        createdAt: true,
      },
    }),
  ]);

  // Attach fileUrl from Proof table (no direct relation in schema)
  const proofIds = entries.map((e) => e.proofId);
  const proofs = await prisma.proof.findMany({
    where: { id: { in: proofIds } },
    select: { id: true, fileUrl: true, fileName: true },
  });
  const proofMap = new Map(proofs.map((p) => [p.id, p]));

  const enriched = entries.map((e) => ({
    ...e,
    fileUrl: proofMap.get(e.proofId)?.fileUrl ?? null,
    fileName: proofMap.get(e.proofId)?.fileName ?? null,
  }));

  return NextResponse.json({ entries: enriched, total, limit, offset });
}
