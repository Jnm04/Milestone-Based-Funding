import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300; // cache 5 minutes

export async function GET() {
  try {
    const [contracts, verifications, agentContracts] = await Promise.all([
      prisma.contract.count(),
      prisma.proof.count({ where: { aiDecision: { not: null } } }),
      prisma.contract.count({ where: { amountUSD: 0 } }),
    ]);

    return NextResponse.json(
      { contracts, verifications, agentContracts },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return NextResponse.json(
      { contracts: 0, verifications: 0, agentContracts: 0 },
      { status: 200 }
    );
  }
}
