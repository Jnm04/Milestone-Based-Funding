import { assertPublicUrl } from "@/lib/validate-url";

export interface FetchResult {
  content: string;
  contentType: string;
  statusCode: number;
}

/**
 * Fetches a public URL and returns its text content.
 * Strips HTML tags to extract readable text for AI evaluation.
 * Capped at 500KB to prevent runaway memory in serverless.
 */
export async function fetchUrl(url: string): Promise<FetchResult> {
  assertPublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let res: Response;
  try {
    res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "cascrow-attestation/1.0 (+https://cascrow.com)" },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const MAX_BYTES = 500_000;

  // Stream with size cap
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BYTES) {
      reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const raw = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");

  // Strip HTML to plain text
  const text = contentType.includes("text/html")
    ? raw
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    : raw;

  return { content: text.slice(0, 100_000), contentType, statusCode: res.status };
}
