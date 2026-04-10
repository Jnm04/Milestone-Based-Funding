import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCertificateSVG } from "@/services/xrpl/cert-image.service";

/**
 * GET /api/nft/cert-image/[contractId]
 * Returns the certificate SVG for a contract or milestone.
 * Public — no auth required (NFT metadata images must be publicly accessible).
 *
 * Query params:
 *   milestoneId — optional, if provided returns the milestone's certificate
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { milestones: true },
  });

  if (!contract) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Use first completed milestone or fallback to contract
  const milestone = contract.milestones.find((m) => m.status === "COMPLETED");
  const title = milestone?.title ?? contract.milestone;
  const amountUSD = (milestone?.amountUSD ?? contract.amountUSD).toString();
  const completedAt = milestone?.updatedAt ?? contract.updatedAt;

  const svg = generateCertificateSVG({
    contractId,
    milestoneTitle: title,
    amountUSD,
    completedAt,
    evmTxHash: contract.evmTxHash ?? null,
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
