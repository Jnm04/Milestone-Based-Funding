import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/api-key-auth";

export async function POST(request: NextRequest) {
  const session = await getMobileSession(request);
  const apiKeyCtx = !session ? await resolveApiKey(request.headers.get("authorization")) : null;
  const userId = session?.user?.id ?? apiKeyCtx?.userId ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let walletAddress: string | undefined;
  try {
    const body = await request.json();
    walletAddress = body.walletAddress;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!walletAddress) {
    return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json({ error: "Invalid EVM wallet address" }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { walletAddress },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user/wallet]", err);
    return NextResponse.json({ error: "Failed to save wallet address" }, { status: 500 });
  }
}
