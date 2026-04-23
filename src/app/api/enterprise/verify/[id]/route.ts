import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id, mode: "ATTESTATION" },
    select: {
      id: true,
      milestone: true,
      createdAt: true,
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          cancelAfter: true,
          regulatoryTags: true,
          dataSourceType: true,
          attestationEntries: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              period: true,
              aiVerdict: true,
              aiReasoning: true,
              certUrl: true,
              xrplTxHash: true,
              createdAt: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const milestones = contract.milestones.map((m) => {
    let tags: string[] = [];
    try { tags = JSON.parse(m.regulatoryTags ?? "[]") as string[]; } catch { /**/ }
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status,
      deadline: m.cancelAfter.toISOString(),
      regulatoryTags: tags,
      dataSourceType: m.dataSourceType,
      latestEntry: m.attestationEntries[0]
        ? {
            period: m.attestationEntries[0].period,
            verdict: m.attestationEntries[0].aiVerdict,
            reasoning: m.attestationEntries[0].aiReasoning,
            certUrl: m.attestationEntries[0].certUrl,
            xrplTxHash: m.attestationEntries[0].xrplTxHash,
            xrplUrl: m.attestationEntries[0].xrplTxHash
              ? `${XRPL_EXPLORER}/tx/${m.attestationEntries[0].xrplTxHash}`
              : null,
            runAt: m.attestationEntries[0].createdAt.toISOString(),
            type: m.attestationEntries[0].type,
          }
        : null,
      totalRuns: m.attestationEntries.length,
      verifiedRuns: m.attestationEntries.filter((e) => e.aiVerdict === "YES").length,
    };
  });

  const verifiedCount = milestones.filter((m) =>
    ["VERIFIED", "COMPLETED"].includes(m.status)
  ).length;

  return NextResponse.json({
    id: contract.id,
    title: contract.milestone,
    createdAt: contract.createdAt.toISOString(),
    totalMilestones: milestones.length,
    verifiedMilestones: verifiedCount,
    milestones,
    xrplExplorer: XRPL_EXPLORER,
    verifiedAt: new Date().toISOString(),
  });
}
