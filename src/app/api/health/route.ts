import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    network: process.env.NEXT_PUBLIC_XRPL_NETWORK ?? "testnet",
  });
}
