import { put } from "@vercel/blob";

const APP_URL = process.env.NEXTAUTH_URL ?? "https://cascrow.com";
const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";

export interface AttestationCertParams {
  milestoneId: string;
  milestoneTitle: string;
  period: string;
  verdict: "YES" | "NO" | "INCONCLUSIVE";
  reasoning: string;
  fetchedHash: string;
  fetchedAt: Date;
  sourceType: string;
  xrplTxHash: string | null;
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
  return lines.slice(0, 3);
}

const VERDICT_COLOR: Record<string, string> = {
  YES: "#4ade80",
  NO: "#f87171",
  INCONCLUSIVE: "#fbbf24",
};

const VERDICT_LABEL: Record<string, string> = {
  YES: "VERIFIED",
  NO: "NOT MET",
  INCONCLUSIVE: "INCONCLUSIVE",
};

function generateSVG(params: AttestationCertParams): string {
  const { milestoneTitle, period, verdict, reasoning, fetchedHash, fetchedAt, sourceType, xrplTxHash } = params;

  const verifiedDate = fetchedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const verdictColor = VERDICT_COLOR[verdict] ?? "#fbbf24";
  const verdictLabel = VERDICT_LABEL[verdict] ?? verdict;
  const titleLines = wrapText(milestoneTitle, 50);
  const reasoningLines = wrapText(reasoning, 68);
  const shortHash = fetchedHash.slice(0, 16) + "…" + fetchedHash.slice(-8);
  const xrplExplorer = IS_TESTNET ? "testnet.xrpscan.com" : "xrpscan.com";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="900" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#171311"/>
      <stop offset="50%" stop-color="#221710"/>
      <stop offset="100%" stop-color="#171311"/>
    </linearGradient>
    <linearGradient id="topline" x1="0" y1="0" x2="900" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4704B" stop-opacity="0"/>
      <stop offset="30%" stop-color="#D4B896"/>
      <stop offset="70%" stop-color="#D4B896"/>
      <stop offset="100%" stop-color="#C4704B" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="900" height="560" fill="url(#bg)"/>
  <rect x="0" y="0" width="900" height="3" fill="url(#topline)"/>
  <rect x="0" y="557" width="900" height="3" fill="url(#topline)"/>

  <!-- Header -->
  <text x="450" y="46" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#C4704B" letter-spacing="4">CORPORATE KPI ATTESTATION CERTIFICATE</text>
  <text x="450" y="72" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#EDE6DD" font-weight="bold">cascrow</text>

  <!-- Divider -->
  <line x1="60" y1="90" x2="840" y2="90" stroke="#C4704B" stroke-opacity="0.3" stroke-width="1"/>

  <!-- Verdict badge -->
  <rect x="340" y="105" width="220" height="42" rx="6" fill="${verdictColor}" fill-opacity="0.15"/>
  <rect x="340" y="105" width="220" height="42" rx="6" fill="none" stroke="${verdictColor}" stroke-width="1.5"/>
  <text x="450" y="132" text-anchor="middle" font-family="monospace" font-size="16" fill="${verdictColor}" font-weight="bold" letter-spacing="2">${escapeXml(verdictLabel)}</text>

  <!-- Milestone title -->
  <text x="450" y="175" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="#C4704B" letter-spacing="2">ATTESTED MILESTONE</text>
  ${titleLines.map((line, i) => `<text x="450" y="${198 + i * 22}" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#EDE6DD">${escapeXml(line)}</text>`).join("\n  ")}

  <!-- Period + date -->
  <text x="450" y="${200 + titleLines.length * 22 + 18}" text-anchor="middle" font-family="monospace" font-size="12" fill="#8B7355">Period: ${escapeXml(period)} · Verified: ${escapeXml(verifiedDate)}</text>

  <!-- Reasoning -->
  <text x="60" y="${200 + titleLines.length * 22 + 52}" font-family="Georgia, serif" font-size="11" fill="#C4704B" letter-spacing="2">AI ASSESSMENT</text>
  ${reasoningLines.map((line, i) => `<text x="60" y="${200 + titleLines.length * 22 + 70 + i * 18}" font-family="Georgia, serif" font-size="13" fill="#D4B896">${escapeXml(line)}</text>`).join("\n  ")}

  <!-- Evidence hash -->
  <text x="60" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 28}" font-family="Georgia, serif" font-size="11" fill="#C4704B" letter-spacing="2">EVIDENCE SHA-256</text>
  <text x="60" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 46}" font-family="monospace" font-size="12" fill="#8B7355">${escapeXml(shortHash)}</text>

  <!-- Data source -->
  <text x="60" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 76}" font-family="Georgia, serif" font-size="11" fill="#C4704B" letter-spacing="2">DATA SOURCE</text>
  <text x="60" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 94}" font-family="monospace" font-size="12" fill="#8B7355">${escapeXml(sourceType.replace("_", " "))}</text>

  <!-- XRPL tx -->
  ${xrplTxHash ? `<text x="450" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 76}" font-family="Georgia, serif" font-size="11" fill="#C4704B" letter-spacing="2">XRPL TRANSACTION</text>
  <text x="450" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 94}" font-family="monospace" font-size="11" fill="#8B7355">${escapeXml(xrplTxHash.slice(0, 20))}…</text>
  <text x="450" y="${200 + titleLines.length * 22 + 70 + reasoningLines.length * 18 + 110}" font-family="monospace" font-size="10" fill="#5A4A3A">${escapeXml(xrplExplorer)}/transactions/${escapeXml(xrplTxHash)}</text>` : ""}

  <!-- Footer -->
  <line x1="60" y1="520" x2="840" y2="520" stroke="#C4704B" stroke-opacity="0.3" stroke-width="1"/>
  <text x="450" y="540" text-anchor="middle" font-family="monospace" font-size="10" fill="#5A4A3A">All data verified by cascrow AI and recorded on XRP Ledger · ${escapeXml(APP_URL)}</text>
</svg>`;
}

/**
 * Generates an attestation certificate SVG, uploads it to Vercel Blob, and returns the public URL.
 */
export async function generateAttestationCert(params: AttestationCertParams): Promise<string> {
  const svg = generateSVG(params);
  const blob = await put(
    `attestation-certs/${params.milestoneId}/${params.period}-cert.svg`,
    svg,
    { access: "public", contentType: "image/svg+xml" }
  );
  return blob.url;
}
