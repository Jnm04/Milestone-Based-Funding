/**
 * SSRF protection: rejects URLs that point to private/reserved IP ranges,
 * link-local addresses, cloud metadata endpoints, or non-http(s) schemes.
 * Call this before any server-side fetch of a user-supplied URL.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.internal.",
  "instance-data",                  // some cloud providers
  "169.254.169.254",                // AWS/GCP/Azure IMDS
  "fd00::ec2:254",                  // AWS IPv6 IMDS
  "::1",
  "0.0.0.0",
  "[::1]",
]);

/** Private / reserved IPv4 prefixes that must never be fetched */
const PRIVATE_IPV4: RegExp[] = [
  /^127\./,                                      // loopback
  /^10\./,                                       // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,                 // RFC 1918
  /^192\.168\./,                                 // RFC 1918
  /^169\.254\./,                                 // link-local / IMDS
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT (RFC 6598)
  /^0\./,                                        // "this" network
  /^192\.0\.2\./,                                // TEST-NET-1
  /^198\.51\.100\./,                             // TEST-NET-2
  /^203\.0\.113\./,                              // TEST-NET-3
  /^240\./,                                      // reserved
];

export function assertPublicUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  // Normalise: strip brackets from IPv6, lowercase
  const host = parsed.hostname.toLowerCase().replace(/^\[/, "").replace(/]$/, "");

  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(parsed.hostname)) {
    throw new Error("URL resolves to a restricted address");
  }

  for (const re of PRIVATE_IPV4) {
    if (re.test(host)) {
      throw new Error("URL resolves to a restricted address");
    }
  }

  // IPv6 private / link-local ranges
  if (
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80") ||
    host.startsWith("::ffff:")     // IPv4-mapped — defer to IPv4 rules above
  ) {
    throw new Error("URL resolves to a restricted address");
  }
}
