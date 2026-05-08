import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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
