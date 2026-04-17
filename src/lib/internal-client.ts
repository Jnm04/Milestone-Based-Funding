/**
 * Browser-side helper for internal admin API calls.
 *
 * Signs every request with HMAC-SHA256(secret, timestamp:method:pathname)
 * so captured or replayed requests are rejected by the server after 5 minutes.
 *
 * Usage — replace:
 *   fetch(url, { headers: { "x-internal-key": key() } })
 * with:
 *   internalFetch(url, {}, key())
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
 * Automatically adds x-internal-key, x-internal-ts, and x-internal-sig headers.
 *
 * @param url     API path or absolute URL
 * @param options Standard RequestInit — do NOT manually include x-internal-* headers
 * @param secret  The INTERNAL_SECRET from sessionStorage
 */
export async function internalFetch(
  url: string,
  options: RequestInit = {},
  secret: string
): Promise<Response> {
  const ts = Date.now().toString();
  const method = (options.method ?? "GET").toUpperCase();

  let pathname: string;
  try {
    pathname = new URL(url, window.location.origin).pathname;
  } catch {
    pathname = url;
  }

  const sig = await hmacHex(secret, `${method}:${pathname}:${ts}`);

  // Merge with existing headers — works for both plain objects and Headers instances.
  // We deliberately do NOT set Content-Type here; callers must pass it themselves
  // (and must NOT set it when the body is FormData, so the browser can add the boundary).
  const merged = new Headers(options.headers as HeadersInit | undefined);
  merged.set("x-internal-key", secret);
  merged.set("x-internal-ts", ts);
  merged.set("x-internal-sig", `sha256=${sig}`);

  return fetch(url, { ...options, headers: merged });
}
