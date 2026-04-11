import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({
    XRPL_NETWORK: process.env.XRPL_NETWORK ?? "(not set)",
    NEXT_PUBLIC_XRPL_NETWORK: process.env.NEXT_PUBLIC_XRPL_NETWORK ?? "(not set)",
    isMainnet: process.env.XRPL_NETWORK === "mainnet" || process.env.NEXT_PUBLIC_XRPL_NETWORK === "mainnet",
  });
}
