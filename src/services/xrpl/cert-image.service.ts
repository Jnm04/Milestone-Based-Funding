const APP_URL = process.env.NEXTAUTH_URL ?? "https://cascrow.com";

export interface CertImageParams {
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  completedAt: Date;
  evmTxHash?: string | null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLen && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2); // max 2 lines
}

export function generateCertificateSVG(params: CertImageParams): string {
  const date = params.completedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const amount = `$${Number(params.amountUSD).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  const titleLines = wrapText(params.milestoneTitle, 42);
  const shortId = params.contractId.slice(0, 10) + "…" + params.contractId.slice(-8);

  const titleY1 = 190;
  const titleY2 = 220;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="800" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#171311"/>
      <stop offset="50%" stop-color="#221710"/>
      <stop offset="100%" stop-color="#171311"/>
    </linearGradient>
    <linearGradient id="topline" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4704B" stop-opacity="0"/>
      <stop offset="30%" stop-color="#D4B896"/>
      <stop offset="50%" stop-color="#C4704B"/>
      <stop offset="70%" stop-color="#D4B896"/>
      <stop offset="100%" stop-color="#C4704B" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="div" x1="0" y1="0" x2="800" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#D4B896" stop-opacity="0"/>
      <stop offset="50%" stop-color="#D4B896" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#D4B896" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="amountglow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4704B"/>
      <stop offset="100%" stop-color="#9A4E2E"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="500" fill="url(#bg)" rx="24"/>

  <!-- Outer border -->
  <rect x="1" y="1" width="798" height="498" fill="none" stroke="#D4B896" stroke-opacity="0.22" stroke-width="1" rx="23"/>

  <!-- Inner border (subtle) -->
  <rect x="12" y="12" width="776" height="476" fill="none" stroke="#D4B896" stroke-opacity="0.08" stroke-width="1" rx="16"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="800" height="3" fill="url(#topline)" rx="2"/>

  <!-- Hex dot grid (very subtle) -->
  <g opacity="0.055">
    ${Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 14 }, (_, col) => {
        const x = 40 + col * 56 + (row % 2 === 0 ? 0 : 28);
        const y = 30 + row * 48;
        return `<circle cx="${x}" cy="${y}" r="1.2" fill="#D4B896"/>`;
      }).join("")
    ).join("")}
  </g>

  <!-- XRPL hex icon (top-left) -->
  <g transform="translate(40, 40)">
    <polygon points="18,2 34,11 34,29 18,38 2,29 2,11" fill="none" stroke="#D4B896" stroke-width="1.4"/>
    <polygon points="18,8 28,14 28,26 18,32 8,26 8,14" fill="#D4B896" fill-opacity="0.08" stroke="#C4704B" stroke-width="0.8"/>
    <circle cx="18" cy="20" r="4" fill="#D4B896"/>
  </g>

  <!-- Platform label -->
  <text x="86" y="55" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="700" letter-spacing="0.22em" fill="#D4B896">CASCROW</text>
  <text x="86" y="72" font-family="Arial, Helvetica, sans-serif" font-size="10" letter-spacing="0.14em" fill="#8A7D72">MILESTONE CERTIFICATE</text>

  <!-- Verified badge (top-right) -->
  <rect x="632" y="40" width="128" height="32" rx="16" fill="#C4704B" fill-opacity="0.14" stroke="#C4704B" stroke-opacity="0.4" stroke-width="1"/>
  <text x="696" y="61" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="0.1em" fill="#C4704B" text-anchor="middle">✓  AI VERIFIED</text>

  <!-- Divider 1 -->
  <rect x="40" y="106" width="720" height="1" fill="url(#div)"/>

  <!-- Milestone title -->
  <text x="400" y="${titleY1}" font-family="Georgia, 'Times New Roman', serif" font-size="${titleLines.length > 1 ? 24 : 28}" font-weight="400" fill="#EDE6DD" text-anchor="middle">${escapeXml(titleLines[0] ?? "")}</text>
  ${titleLines[1] ? `<text x="400" y="${titleY2}" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="400" fill="#EDE6DD" text-anchor="middle">${escapeXml(titleLines[1])}</text>` : ""}

  <!-- Amount -->
  <text x="400" y="290" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="300" fill="#C4704B" text-anchor="middle">${escapeXml(amount)}</text>
  <text x="400" y="316" font-family="Arial, Helvetica, sans-serif" font-size="13" letter-spacing="0.18em" fill="#8A7D72" text-anchor="middle">RLUSD</text>

  <!-- Divider 2 -->
  <rect x="40" y="340" width="720" height="1" fill="url(#div)"/>

  <!-- Details row -->
  <text x="64" y="374" font-family="Arial, Helvetica, sans-serif" font-size="9.5" letter-spacing="0.16em" fill="#8A7D72">COMPLETED</text>
  <text x="64" y="396" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#EDE6DD">${escapeXml(date)}</text>

  <text x="400" y="374" font-family="Arial, Helvetica, sans-serif" font-size="9.5" letter-spacing="0.16em" fill="#8A7D72" text-anchor="middle">CONTRACT</text>
  <text x="400" y="396" font-family="'Courier New', Courier, monospace" font-size="11.5" fill="#D4B896" text-anchor="middle">${escapeXml(shortId)}</text>

  <text x="736" y="374" font-family="Arial, Helvetica, sans-serif" font-size="9.5" letter-spacing="0.16em" fill="#8A7D72" text-anchor="end">NETWORK</text>
  <text x="736" y="396" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#EDE6DD" text-anchor="end">XRP Ledger</text>

  <!-- Footer -->
  <rect x="40" y="432" width="720" height="1" fill="#D4B896" fill-opacity="0.08"/>
  <text x="64" y="458" font-family="Arial, Helvetica, sans-serif" font-size="9.5" letter-spacing="0.07em" fill="#5A4F47">Non-transferable · Permanent on-chain record</text>
  <text x="736" y="458" font-family="Arial, Helvetica, sans-serif" font-size="9.5" letter-spacing="0.07em" fill="#5A4F47" text-anchor="end">cascrow.com · XRPL EVM Sidechain</text>
</svg>`;
}

export interface CertAssets {
  imageUrl: string;
  metadataUrl: string;
}

/**
 * Returns public URLs for the certificate image and metadata JSON.
 * The image is served dynamically via /api/nft/cert-image/[contractId] — no storage needed.
 * The metadata JSON is served via /api/nft/cert-metadata/[contractId].
 */
export function uploadCertificateAssets(params: CertImageParams): CertAssets {
  const base = APP_URL.replace(/\/$/, "");
  return {
    imageUrl: `${base}/api/nft/cert-image/${params.contractId}`,
    metadataUrl: `${base}/api/nft/cert-metadata/${params.contractId}`,
  };
}
