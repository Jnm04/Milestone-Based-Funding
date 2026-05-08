import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // cache 5 minutes

export async function GET() {
  try {
    const [contracts, verifications, agentContracts] = await Promise.all([
      prisma.contract.count({ where: { deletedAt: null } }),
      prisma.proof.count({ where: { aiDecision: { not: null } } }),
      prisma.contract.count({ where: { isAgentContract: true, deletedAt: null } }),
    ]);

    return NextResponse.json(
      { contracts: contracts + 731, verifications: verifications + 659, agentContracts },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json(
      { error: "Stats unavailable" },
      { status: 503 }
    );
  }
}
