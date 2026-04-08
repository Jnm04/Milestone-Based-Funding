import { NextRequest, NextResponse } from "next/server";
import { getBrainStats } from "@/services/brain/training.service";

function isAuthorized(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  return key === process.env.INTERNAL_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const stats = await getBrainStats();
  return NextResponse.json(stats);
}
