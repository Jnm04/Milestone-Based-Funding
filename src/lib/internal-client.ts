/**
 * Browser-side helper for internal admin API calls.
 *
 * Auth via HTTP-only cookie `cascrow_admin` set by /api/internal/auth after login.
 * The cookie is invisible to JavaScript and never exposed in request headers.
 */

/**
 * Drop-in replacement for fetch() on /api/internal/* routes.
 * Relies solely on the HTTP-only session cookie — no secrets in JS memory.
 */
export async function internalFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, { ...options, credentials: "same-origin" });
}
