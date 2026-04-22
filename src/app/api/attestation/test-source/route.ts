import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { fetchUrl } from "@/services/attestation/fetchers/url-scrape";
import { fetchRestApi } from "@/services/attestation/fetchers/rest-api";
import { z } from "zod";

const testSourceSchema = z.object({
  dataSourceType: z.enum(["URL_SCRAPE", "REST_API"]),
  dataSourceUrl: z.string().url("Must be a valid URL").max(2000),
  apiKey: z.string().max(1000).optional(),
  dataSourceConfig: z
    .object({
      method: z.enum(["GET", "POST"]).optional(),
      headers: z.record(z.string()).optional(),
      responsePath: z.string().max(200).optional(),
    })
    .optional(),
});

/**
 * Dry-run: fetches the data source and returns a preview of the content.
 * Does NOT write to chain, does NOT create an AttestationEntry.
 * Rate limited: 10/hour per user.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  if (!(await checkRateLimit(`attestation-test-source:${session.user.id ?? ip}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many test requests. Please wait before trying again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = testSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { dataSourceType, dataSourceUrl, apiKey, dataSourceConfig } = parsed.data;

  try {
    let content: string;
    let statusCode: number;

    if (dataSourceType === "URL_SCRAPE") {
      const result = await fetchUrl(dataSourceUrl);
      content = result.content;
      statusCode = result.statusCode;
    } else {
      if (!apiKey) {
        return NextResponse.json({ error: "apiKey is required for REST_API test" }, { status: 400 });
      }
      const result = await fetchRestApi(dataSourceUrl, apiKey, {
        method: dataSourceConfig?.method ?? "GET",
        headers: dataSourceConfig?.headers ?? {},
        responsePath: dataSourceConfig?.responsePath,
      });
      content = result.content;
      statusCode = result.statusCode;
    }

    return NextResponse.json({
      success: true,
      statusCode,
      preview: content.slice(0, 2000),
      totalLength: content.length,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Fetch failed";
    // Surface SSRF/config errors as-is; strip internal network details from connection errors
    const message =
      raw.startsWith("URL resolves") || raw.startsWith("Only http") || raw.startsWith("Invalid URL")
        ? raw
        : raw.match(/^HTTP \d{3}/)
        ? raw
        : "Could not reach the data source. Check the URL and try again.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
