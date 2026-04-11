import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const XRPL_HTTP =
  process.env.XRPL_HTTP_URL ??
  (process.env.XRPL_NETWORK === "testnet"
    ? "https://s.altnet.rippletest.net:51234"
    : "https://s1.ripple.com:51234");

async function checkDatabase(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkXrpl(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(XRPL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "server_info", params: [{}] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const [db, xrpl] = await Promise.all([checkDatabase(), checkXrpl()]);

  const checks = {
    database: db,
    xrpl: xrpl,
    blob: { ok: !!process.env.BLOB_READ_WRITE_TOKEN },
    resend: { ok: !!process.env.RESEND_API_KEY },
  };

  const healthy = checks.database.ok && checks.xrpl.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      network: process.env.NEXT_PUBLIC_XRPL_NETWORK ?? "mainnet",
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
