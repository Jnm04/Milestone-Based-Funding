import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { generateCertificateSVG } from "@/services/xrpl/cert-image.service";

export const runtime = "nodejs";

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

  const milestone = contract.milestones.find((m) => m.status === "COMPLETED");
  const title = milestone?.title ?? contract.milestone;
  const amountUSD = (milestone?.amountUSD ?? contract.amountUSD).toString();
  const completedAt = milestone?.updatedAt ?? contract.updatedAt;
  const shortId = contractId.slice(0, 10) + "…" + contractId.slice(-8);
  const amount = `$${Number(amountUSD).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  const date = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // PNG — uses next/og ImageResponse (Satori) for Turbopack-compatible PNG generation
  if (format === "png") {
    const img = new ImageResponse(
      (
        <div
          style={{
            width: 800,
            height: 500,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #171311 0%, #221710 50%, #171311 100%)",
            borderRadius: 24,
            border: "1px solid rgba(212,184,150,0.22)",
            position: "relative",
            overflow: "hidden",
            fontFamily: "sans-serif",
          }}
        >
          {/* Top accent line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, transparent, #D4B896, #C4704B, #D4B896, transparent)",
            }}
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "36px 48px 0",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "#D4B896" }}>
                CASCROW
              </span>
              <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "#8A7D72" }}>
                MILESTONE CERTIFICATE
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 20px",
                borderRadius: 16,
                background: "rgba(196,112,75,0.14)",
                border: "1px solid rgba(196,112,75,0.4)",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#C4704B" }}>
                ✓  AI VERIFIED
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, margin: "20px 48px 0", background: "rgba(212,184,150,0.15)" }} />

          {/* Milestone title */}
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 60px",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: title.length > 40 ? 24 : 30,
                color: "#EDE6DD",
                textAlign: "center",
                fontWeight: 400,
                lineHeight: 1.3,
              }}
            >
              {title}
            </span>

            {/* Amount */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 }}>
              <span style={{ fontSize: 72, fontWeight: 300, color: "#C4704B", lineHeight: 1 }}>
                {amount}
              </span>
              <span style={{ fontSize: 13, letterSpacing: "0.18em", color: "#8A7D72", marginTop: 4 }}>
                RLUSD
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, margin: "0 48px", background: "rgba(212,184,150,0.15)" }} />

          {/* Details row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "20px 64px 28px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.16em", color: "#8A7D72" }}>COMPLETED</span>
              <span style={{ fontSize: 14, color: "#EDE6DD" }}>{date}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 9, letterSpacing: "0.16em", color: "#8A7D72" }}>CONTRACT</span>
              <span style={{ fontSize: 11, color: "#D4B896", fontFamily: "monospace" }}>{shortId}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <span style={{ fontSize: 9, letterSpacing: "0.16em", color: "#8A7D72" }}>NETWORK</span>
              <span style={{ fontSize: 14, color: "#EDE6DD" }}>XRP Ledger</span>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 64px 24px",
              borderTop: "1px solid rgba(212,184,150,0.06)",
              paddingTop: 14,
            }}
          >
            <span style={{ fontSize: 9, letterSpacing: "0.07em", color: "#5A4F47" }}>
              Non-transferable · Permanent on-chain record
            </span>
            <span style={{ fontSize: 9, letterSpacing: "0.07em", color: "#5A4F47" }}>
              cascrow.com · XRPL EVM Sidechain
            </span>
          </div>
        </div>
      ),
      { width: 800, height: 500 }
    );

    // ImageResponse returns a Response; wrap headers for cache control
    const buf = await img.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  }

  // Default: SVG
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
