import { URL } from "url";

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  // IPv6 ULA (fc00::/7 covers fc and fd), link-local, loopback
  /^f[cd][0-9a-f]{0,2}[:%]/i,
  /^fe80[:%]/i,
  /^::1$/,
];

const LOOPBACK_HOSTNAMES = new Set(["localhost", "::1", "0.0.0.0"]);

/**
 * Returns true only if the URL is a public HTTPS endpoint that cannot reach
 * private/loopback/link-local addresses. Use before any server-side fetch of
 * user-supplied URLs to prevent SSRF.
 */
export function isSafePublicUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(hostname)) return false;

  for (const re of PRIVATE_RANGES) {
    if (re.test(hostname)) return false;
  }

  return true;
}

const TEAMS_WEBHOOK_DOMAINS = [
  "outlook.office.com",
  "outlook.office365.com",
  "prod-",
];

export function isValidTeamsWebhookUrl(raw: string): boolean {
  if (!isSafePublicUrl(raw)) return false;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return TEAMS_WEBHOOK_DOMAINS.some((d) => host === d || host.endsWith("." + d) || host.startsWith("prod-"));
}
