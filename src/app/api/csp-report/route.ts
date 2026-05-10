import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) ?? "unknown";
  if (!(await checkRateLimit(`csp-report:${ip}`, 30, 60 * 1000))) {
    return new NextResponse(null, { status: 204 }); // silently drop, no 429 needed
  }
  try {
    const body = await request.json();
    const report = body["csp-report"] ?? body;
    console.warn("[csp-violation]", JSON.stringify({
      blockedUri:   report["blocked-uri"],
      violatedDir:  report["violated-directive"],
      effectiveDir: report["effective-directive"],
      documentUri:  report["document-uri"],
      sourceFile:   report["source-file"],
      lineNumber:   report["line-number"],
      columnNumber: report["column-number"],
    }));
  } catch {
    // Malformed report — ignore
  }
  return new NextResponse(null, { status: 204 });
}
