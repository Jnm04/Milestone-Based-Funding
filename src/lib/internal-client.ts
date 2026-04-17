/**
 * Browser-side helper for internal admin API calls.
 *
 * Cookie mode (default — no secret passed):
 *   The browser automatically sends the `cascrow_admin` HTTP-only session
 *   cookie set by /api/internal/auth. No secret ever touches JS memory.
 *   Usage: internalFetch(url, options)
 *
 * HMAC mode (legacy / programmatic access):
 *   Signs every request with HMAC-SHA256(secret, method:pathname:ts)
 *   so captured or replayed requests are rejected by the server after 5 min.
 *   Usage: internalFetch(url, options, secret)
 */

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Drop-in replacement for fetch() on /api/internal/* routes.
 *
 * @param url     API path or absolute URL
 * @param options Standard RequestInit — do NOT manually include x-internal-* headers
 * @param secret  Optional. If omitted or empty, auth relies on the HTTP-only
 *                session cookie (preferred). If provided, adds HMAC headers.
 */
export async function internalFetch(
  url: string,
  options: RequestInit = {},
  secret = ""
): Promise<Response> {
  // Cookie mode: browser sends cascrow_admin automatically — no headers needed.
  if (!secret) {
    return fetch(url, { ...options, credentials: "same-origin" });
  }

  // HMAC mode: sign the request with the provided secret.
  const ts = Date.now().toString();
  const method = (options.method ?? "GET").toUpperCase();

  let pathname: string;
  try {
    pathname = new URL(url, window.location.origin).pathname;
  } catch {
    pathname = url;
  }

  const sig = await hmacHex(secret, `${method}:${pathname}:${ts}`);

  // We deliberately do NOT set Content-Type here; callers must pass it themselves
  // (and must NOT set it when the body is FormData, so the browser can add the boundary).
  const merged = new Headers(options.headers as HeadersInit | undefined);
  merged.set("x-internal-key", secret);
  merged.set("x-internal-ts", ts);
  merged.set("x-internal-sig", `sha256=${sig}`);

  return fetch(url, { ...options, headers: merged });
}
