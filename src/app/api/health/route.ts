import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const XRPL_HTTP =
  process.env.XRPL_HTTP_URL ??
  (process.env.XRPL_NETWORK === "testnet"
    ? "https://s.altnet.rippletest.net:51234"
    : "https://s1.ripple.com:51234");

const EVM_RPC = process.env.NEXT_PUBLIC_EVM_RPC_URL ?? "https://rpc.testnet.xrplevm.org";

interface ServiceResult {
  ok: boolean;
  latencyMs?: number;
  detail?: string;
}

async function checkDatabase(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return { ok: false, detail: "Database unreachable" };
  }
}

async function checkXrpl(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const res = await fetch(XRPL_HTTP, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "server_info", params: [{}] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const data = await res.json();
    const state = data?.result?.info?.server_state;
    if (state && state !== "full" && state !== "proposing") {
      return { ok: false, latencyMs: Date.now() - start, detail: `server_state: ${state}` };
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    console.error("[health] XRPL check failed:", err);
    return { ok: false, detail: "XRPL unreachable" };
  }
}

async function checkEvmRpc(): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const res = await fetch(EVM_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "net_version", params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, detail: "EVM RPC unreachable" };
  }
}

function checkAnthropic(): ServiceResult {
  // Only check key presence — a live API call would reveal key validity/status to anonymous callers
  return { ok: !!process.env.ANTHROPIC_API_KEY };
}

export async function GET() {
  const [db, xrpl, evm] = await Promise.all([
    checkDatabase(),
    checkXrpl(),
    checkEvmRpc(),
  ]);
  const ai = checkAnthropic();

  const allOk = [db, xrpl, evm, ai].every((s) => s.ok);
  const overallStatus = allOk ? "operational" : "degraded";

  const fmt = (s: ServiceResult) => ({
    ok: s.ok,
    ...(s.latencyMs !== undefined ? { latencyMs: s.latencyMs } : {}),
    ...(s.detail !== undefined ? { detail: s.detail } : {}),
  });

  return NextResponse.json(
    {
      status: overallStatus,
      services: {
        database: { label: "Database", ...fmt(db) },
        xrpl: { label: "XRPL Mainnet (NFT / Audit)", ...fmt(xrpl) },
        evmRpc: { label: "XRPL EVM Sidechain (Escrow)", ...fmt(evm) },
        ai: { label: "AI Verification (Anthropic)", ...fmt(ai) },
      },
      network: process.env.XRPL_NETWORK ?? "mainnet",
      checkedAt: new Date().toISOString(),
    },
    {
      status: allOk ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
