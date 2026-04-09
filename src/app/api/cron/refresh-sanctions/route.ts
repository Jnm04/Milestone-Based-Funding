import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadOfacList, invalidateSanctionsCache } from "@/services/sanctions/sanctions.service";

/**
 * GET /api/cron/refresh-sanctions
 * Daily Vercel Cron — downloads the latest OFAC SDN list and caches it in the DB.
 * Protected by CRON_SECRET.
 *
 * The list is ~500 KB. Parse + store takes <5s in practice.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/refresh-sanctions] Downloading OFAC SDN list...");
    const { entries, publishedAt } = await downloadOfacList();

    await prisma.sanctionsCache.upsert({
      where: { listName: "OFAC_SDN" },
      create: {
        listName: "OFAC_SDN",
        entries: JSON.stringify(entries),
        publishedAt,
      },
      update: {
        entries: JSON.stringify(entries),
        publishedAt,
      },
    });

    // Bust the in-process TTL cache so the next screenName() picks up fresh data
    invalidateSanctionsCache();

    console.log(`[cron/refresh-sanctions] Stored ${entries.length} SDN entries.`);
    return NextResponse.json({ ok: true, entryCount: entries.length, publishedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/refresh-sanctions] Failed:", msg);
    // Return 200 so Vercel doesn't treat this as a hard cron failure on network blips
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
