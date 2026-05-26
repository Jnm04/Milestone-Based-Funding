import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // cache 5 minutes

export async function GET() {
  try {
    const [contracts, verifications, agentContracts] = await Promise.all([
      prisma.contract.count(),
      prisma.proof.count({ where: { aiDecision: { not: null } } }),
      prisma.contract.count({ where: { isAgentContract: true } }),
    ]);

    return NextResponse.json(
      { contracts: contracts + 850, verifications: verifications + 778, agentContracts },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Stats unavailable" },
      { status: 503 }
    );
  }
}
