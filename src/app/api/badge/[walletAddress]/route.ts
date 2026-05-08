import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// GET /api/badge/[walletAddress]
// Public. Returns an SVG trust badge for an agent profile.
// Embeddable in external agent profiles, readmes, or marketplace listings.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`badge:${ip}`, 60, 60_000))) {
    return new NextResponse("Rate limit exceeded", { status: 429 });
  }

  const { walletAddress } = await params;

  // Validate format before hitting DB — accepts EVM (0x…) or XRPL (r…) addresses
  if (!/^(0x[0-9a-fA-F]{40}|r[1-9A-HJ-NP-Za-km-z]{24,34})$/.test(walletAddress)) {
    return new NextResponse("Agent not found", { status: 404 });
  }

  const agent = await prisma.user.findUnique({
    where: { walletAddress: walletAddress.toLowerCase() },
    select: {
      id: true,
      name: true,
      startupContracts: {
        where: { isAgentContract: true, deletedAt: null },
        select: {
          milestones: {
            where: { status: { in: ["COMPLETED", "REJECTED"] } },
            select: { status: true, amountUSD: true },
          },
        },
      },
    },
  });

  if (!agent) {
    return new NextResponse("Agent not found", { status: 404 });
  }

  const allMilestones = agent.startupContracts.flatMap((c) => c.milestones);
  const completed = allMilestones.filter((m) => m.status === "COMPLETED");
  const total = allMilestones.length;
  const successRate = total > 0 ? Math.round((completed.length / total) * 100) : null;
  const totalRlusd = completed.reduce((s, m) => s + Number(m.amountUSD), 0);

  const displayName = agent.name ?? walletAddress.slice(0, 8) + "…";
  const rateLabel = successRate !== null ? `${successRate}%` : "–";
  const completedLabel = `${completed.length} verified`;
  const rlusdLabel = `$${totalRlusd.toFixed(0)} RLUSD`;

  // Copper/amber design matching cascrow brand
  const COPPER = "#C4704B";
  const BG = "#1E1714";
  const TEXT = "#EDE6DD";
  const MUTED = "#A89B8C";
  const BORDER = "#3A2E28";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="80" viewBox="0 0 280 80" role="img" aria-label="Cascrow trust badge for ${displayName}">
  <title>Cascrow Verified Agent — ${displayName}</title>
  <rect width="280" height="80" rx="10" fill="${BG}" />
  <rect x="0.5" y="0.5" width="279" height="79" rx="9.5" fill="none" stroke="${BORDER}" />

  <!-- Logo mark -->
  <rect x="12" y="12" width="22" height="22" rx="5" fill="${COPPER}" />
  <text x="23" y="28" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle" fill="${BG}">c</text>

  <!-- cascrow label -->
  <text x="40" y="20" font-family="monospace" font-size="9" letter-spacing="2" fill="${COPPER}" text-transform="uppercase">CASCROW</text>
  <text x="40" y="32" font-family="monospace" font-size="9" letter-spacing="1" fill="${MUTED}">Verified Agent</text>

  <!-- Agent name -->
  <text x="12" y="54" font-family="monospace" font-size="11" font-weight="600" fill="${TEXT}">${escapeXml(displayName)}</text>

  <!-- Stats row -->
  <text x="12" y="68" font-family="monospace" font-size="9" fill="${MUTED}">${escapeXml(completedLabel)}</text>
  <text x="88" y="68" font-family="monospace" font-size="9" fill="${MUTED}">·</text>
  <text x="96" y="68" font-family="monospace" font-size="9" fill="${successRate !== null && successRate >= 80 ? COPPER : MUTED}">${rateLabel} success</text>
  <text x="168" y="68" font-family="monospace" font-size="9" fill="${MUTED}">·</text>
  <text x="176" y="68" font-family="monospace" font-size="9" fill="${MUTED}">${escapeXml(rlusdLabel)}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
