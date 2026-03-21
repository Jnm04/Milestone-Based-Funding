import { NextRequest, NextResponse } from "next/server";
import { getXummPayloadResult } from "@/services/xrpl/xumm.service";

/**
 * GET /api/auth/xumm-result?uuid=<payload-uuid>
 * Polls Xumm for the result of a sign request.
 * Frontend calls this every 2s until signed or resolved.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uuid = searchParams.get("uuid");

  if (!uuid) {
    return NextResponse.json({ error: "uuid is required" }, { status: 400 });
  }

  try {
    const result = await getXummPayloadResult(uuid);

    if (!result) {
      return NextResponse.json({ error: "Payload not found" }, { status: 404 });
    }

    return NextResponse.json({
      signed: result.signed,
      resolved: result.resolved,
      address: result.signerAddress ?? null,
      txHash: result.txHash ?? null,
    });
  } catch (err) {
    console.error("Xumm result error:", err);
    return NextResponse.json({ error: "Failed to fetch Xumm result" }, { status: 500 });
  }
}
