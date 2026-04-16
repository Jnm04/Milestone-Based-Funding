import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import { getBrainStats } from "@/services/brain/training.service";


export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const stats = await getBrainStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[internal/stats] GET failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
