import { assertPublicUrl } from "@/lib/validate-url";

export interface RestApiConfig {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  responsePath?: string; // dot-notation path to extract from JSON, e.g. "data.revenue"
}

export interface FetchResult {
  content: string;
  contentType: string;
  statusCode: number;
}

/**
 * Calls a REST API endpoint with the provided API key and config.
 * The API key is sent as a Bearer token unless a custom Authorization header is set.
 * Response is truncated at 100KB for AI evaluation.
 */
/** Strip CRLF chars from header names and values to prevent header injection */
function sanitizeHeaders(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const name = k.replace(/[\r\n]/g, "").trim();
    const value = v.replace(/[\r\n]/g, "").trim();
    if (name) out[name] = value;
  }
  return out;
}

export async function fetchRestApi(
  url: string,
  apiKey: string,
  config: RestApiConfig = {}
): Promise<FetchResult> {
  assertPublicUrl(url);

  const { method = "GET", headers: extraHeaders = {}, body, responsePath } = config;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "cascrow-attestation/1.0 (+https://cascrow.com)",
    ...sanitizeHeaders(extraHeaders),
  };

  // Only inject Bearer if no Authorization header is already provided
  if (!headers["Authorization"] && !headers["authorization"]) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else {
    // Replace placeholder {{API_KEY}} in custom Authorization if present
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === "authorization") {
        headers[key] = headers[key].replace("{{API_KEY}}", apiKey);
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} calling API`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const raw = (await res.text()).slice(0, 100_000);

  // If a responsePath is set, try to extract just that subtree from JSON
  if (responsePath && contentType.includes("application/json")) {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const extracted = responsePath.split(".").reduce<unknown>((obj, key) => {
        if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[key];
        return undefined;
      }, json);
      if (extracted !== undefined) {
        return {
          content: JSON.stringify(extracted, null, 2).slice(0, 100_000),
          contentType,
          statusCode: res.status,
        };
      }
    } catch {
      // Fall through to return raw if JSON parse fails
    }
  }

  return { content: raw, contentType, statusCode: res.status };
}
