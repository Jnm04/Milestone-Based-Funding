import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key")?.trim();
  const secret = process.env.INTERNAL_SECRET?.trim();
  return key && secret && key === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.trainingEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      proofId: true,
      milestoneText: true,
      label: true,
      labelSource: true,
      consensusLevel: true,
      fraudType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries });
}
