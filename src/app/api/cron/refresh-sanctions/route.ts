import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadOfacList, downloadOfacWalletList, invalidateSanctionsCache } from "@/services/sanctions/sanctions.service";
import { isValidCronSecret } from "@/lib/cron-auth";

/**
 * GET /api/cron/refresh-sanctions
 * Daily Vercel Cron — downloads the latest OFAC SDN list and caches it in the DB.
 * Protected by CRON_SECRET.
 *
 * The list is ~500 KB. Parse + store takes <5s in practice.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/refresh-sanctions] Downloading OFAC SDN list (names + wallets)...");
    const [{ entries, publishedAt }, { wallets }] = await Promise.all([
      downloadOfacList(),
      downloadOfacWalletList(),
    ]);

    await Promise.all([
      prisma.sanctionsCache.upsert({
        where: { listName: "OFAC_SDN" },
        create: { listName: "OFAC_SDN", entries: JSON.stringify(entries), publishedAt },
        update: { entries: JSON.stringify(entries), publishedAt },
      }),
      prisma.sanctionsCache.upsert({
        where: { listName: "OFAC_WALLETS" },
        create: { listName: "OFAC_WALLETS", entries: JSON.stringify(wallets), publishedAt },
        update: { entries: JSON.stringify(wallets), publishedAt },
      }),
    ]);

    // Bust both in-process TTL caches so next screen*() calls pick up fresh data
    invalidateSanctionsCache();

    console.log(`[cron/refresh-sanctions] Stored ${entries.length} SDN names, ${wallets.length} wallet addresses.`);
    return NextResponse.json({ ok: true, entryCount: entries.length, walletCount: wallets.length, publishedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/refresh-sanctions] Failed:", msg);
    // Return 200 so Vercel doesn't treat this as a hard cron failure on network blips
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
