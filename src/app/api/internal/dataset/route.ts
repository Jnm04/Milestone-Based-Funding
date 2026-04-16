import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? "");
  const limit = Math.min(Math.max(1, Number.isNaN(limitRaw) ? 50 : limitRaw), 200);
  const offsetRaw = parseInt(searchParams.get("offset") ?? "");
  const offset = Math.max(0, Number.isNaN(offsetRaw) ? 0 : offsetRaw);

  try {
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
  } catch (err) {
    console.error("[internal/dataset] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch dataset" }, { status: 500 });
  }
}
