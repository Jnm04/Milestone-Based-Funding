import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCertificateSVG } from "@/services/xrpl/cert-image.service";

/**
 * GET /api/nft/cert-image/[contractId]
 * Returns the certificate as SVG (default) or PNG (?format=png).
 * Public — no auth required (NFT metadata images must be publicly accessible).
 *
 * Query params:
 *   format — "png" to get a PNG image (for marketplace compatibility), omit for SVG
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const { contractId } = await params;
  const format = req.nextUrl.searchParams.get("format");

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

  // PNG format — for marketplace compatibility (xrp.cafe, onXRP don't render SVG)
  if (format === "png") {
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svg, {
        fitTo: { mode: "width" as const, value: 800 },
      });
      const pngBuffer = resvg.render().asPng();
      return new NextResponse(pngBuffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    } catch {
      // Fallback to SVG if PNG conversion fails
    }
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
