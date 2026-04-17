import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://cascrow.com";

// H6: simple in-process IP rate limiter — 30 requests/min per IP
const IP_RATE_LIMIT = 30;
const IP_RATE_WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkIpRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + IP_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= IP_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

/**
 * GET /api/nft/cert-metadata/[contractId]
 * Returns ERC-721-compatible metadata JSON for the NFT certificate.
 * Public — no auth required.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkIpRate(ip)) {
    return new NextResponse("Too Many Requests", { status: 429, headers: { "Retry-After": "60" } });
  }

  const { contractId } = await params;

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
  const completedAt = (milestone?.updatedAt ?? contract.updatedAt).toISOString().slice(0, 10);
  const base = APP_URL.replace(/\/$/, "");

  const metadata = {
    name: `Cascrow Certificate — ${title.slice(0, 60)}`,
    description: `Milestone verified by Claude AI on ${completedAt}. Amount: $${amountUSD} RLUSD. Platform: Cascrow (cascrow.com).`,
    image: `${base}/api/nft/cert-image/${contractId}?format=png`,
    external_url: `${base}/contract/${contractId}`,
    attributes: [
      { trait_type: "Platform", value: "Cascrow" },
      { trait_type: "Amount (RLUSD)", value: amountUSD },
      { trait_type: "Milestone", value: title.slice(0, 80) },
      { trait_type: "Completed", value: completedAt },
      { trait_type: "Network", value: "XRP Ledger" },
      { trait_type: "Type", value: "Completion Certificate" },
    ],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
