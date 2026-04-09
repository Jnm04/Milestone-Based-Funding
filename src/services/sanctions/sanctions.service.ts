/**
 * Sanctions Screening Service
 * ===========================
 * Screens names against the OFAC SDN (Specially Designated Nationals) list,
 * the single most important sanctions list for US compliance.
 *
 * The list is a free public download from the US Treasury Department.
 * Updated daily by /api/cron/refresh-sanctions.
 * Cached in the database (SanctionsCache model) to avoid per-request network calls.
 * An in-process LRU-style TTL cache (1 hour) prevents DB hits on every check.
 *
 * Design principles:
 *  - Never throws. Returns { hit: false } on any failure.
 *  - Fuzzy matching: normalise both sides (lowercase, collapse whitespace, strip
 *    punctuation) then check for exact token overlap (>=2 shared tokens of >=3
 *    chars). This catches "John Smith" == "SMITH John" while ignoring noise.
 *  - Conservative: only flag when there is meaningful overlap — false positives
 *    on common names are surfaced for manual review, not hard-blocked.
 */

import { prisma } from "@/lib/prisma";

// ─── In-process cache (1 hour TTL) ────────────────────────────────────────────

let _cachedEntries: string[] | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── OFAC SDN download ────────────────────────────────────────────────────────

/**
 * Download the OFAC SDN "consolidated" CSV from the US Treasury.
 * The CSV has a header row; each subsequent row has the full name in column 0.
 * Format: "Last Name, First Name" for individuals; plain company name for entities.
 *
 * Source: https://www.treasury.gov/ofac/downloads/consolidated/consolidated.xml
 * We use the SDN CSV (simpler, ~500 KB): https://www.treasury.gov/ofac/downloads/sdn.csv
 */
const OFAC_SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv";

interface DownloadResult {
  entries: string[];
  publishedAt: string;
}

export async function downloadOfacList(): Promise<DownloadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(OFAC_SDN_CSV_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "Cascrow-Compliance/1.0" },
    });
    if (!res.ok) {
      throw new Error(`OFAC download failed: HTTP ${res.status}`);
    }
    const text = await res.text();
    const entries = parseOfacCsv(text);
    return { entries, publishedAt: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the OFAC SDN CSV and extract normalised name strings.
 * Column 0 is the primary name, column 1 is the SDN type (individual/entity/vessel/aircraft).
 * We extract all non-vessel, non-aircraft entries (individuals + entities).
 */
function parseOfacCsv(csv: string): string[] {
  const lines = csv.split("\n");
  const names: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Split on comma but respect quoted fields
    const cols = splitCsvLine(line);
    if (cols.length < 2) continue;
    const name = cols[0].replace(/^"|"$/g, "").trim();
    const type = (cols[1] ?? "").replace(/^"|"$/g, "").trim().toLowerCase();
    // Skip vessels and aircraft — not relevant for user screening
    if (type === "vessel" || type === "aircraft") continue;
    if (!name || name.toLowerCase() === "name") continue; // skip header
    const normalised = normaliseName(name);
    if (normalised.length >= 3) names.push(normalised);
  }

  return [...new Set(names)];
}

/** Minimal CSV field splitter — handles double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ─── Name normalisation ────────────────────────────────────────────────────────

/** Lowercase, remove punctuation, collapse whitespace, split into tokens. */
function normaliseToTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length >= 3);
}

/** Returns a single normalised string for storage / index lookup. */
function normaliseName(name: string): string {
  return normaliseToTokens(name).sort().join(" ");
}

// ─── Load from DB (with in-process TTL cache) ─────────────────────────────────

async function loadEntries(): Promise<string[]> {
  const now = Date.now();
  if (_cachedEntries && now < _cacheExpiry) return _cachedEntries;

  try {
    const row = await prisma.sanctionsCache.findUnique({
      where: { listName: "OFAC_SDN" },
    });
    if (!row) {
      _cachedEntries = [];
    } else {
      _cachedEntries = JSON.parse(row.entries) as string[];
    }
    _cacheExpiry = now + CACHE_TTL_MS;
    return _cachedEntries;
  } catch (err) {
    console.warn("[sanctions] Failed to load from DB (non-fatal):", err);
    return _cachedEntries ?? [];
  }
}

/** Invalidate the in-process cache after a list refresh. */
export function invalidateSanctionsCache(): void {
  _cachedEntries = null;
  _cacheExpiry = 0;
}

// ─── Screening ─────────────────────────────────────────────────────────────────

export interface ScreenResult {
  /** true if a potential match was found — requires human review */
  hit: boolean;
  /** Normalised SDN names that matched */
  matches: string[];
}

/**
 * Screen a name (person or company) against the OFAC SDN list.
 *
 * Matching logic:
 *  1. Tokenise both the query and each SDN entry.
 *  2. Count shared tokens (≥3 chars).
 *  3. Flag if ≥2 tokens overlap AND the overlap covers ≥40% of the query's tokens.
 *     This avoids flagging "John" alone while catching "John Smith" against "SMITH, John".
 *
 * Returns { hit: false } on any error — screening failure is never a hard block.
 */
export async function screenName(name: string): Promise<ScreenResult> {
  try {
    if (!name || name.trim().length < 3) return { hit: false, matches: [] };
    const entries = await loadEntries();
    if (entries.length === 0) return { hit: false, matches: [] };

    const queryTokens = normaliseToTokens(name);
    if (queryTokens.length === 0) return { hit: false, matches: [] };
    const querySet = new Set(queryTokens);

    const matches: string[] = [];

    for (const entry of entries) {
      const entryTokens = entry.split(" ").filter((t) => t.length >= 3);
      let shared = 0;
      for (const t of entryTokens) {
        if (querySet.has(t)) shared++;
      }
      // ≥2 shared tokens AND overlap ≥40% of query length
      if (shared >= 2 && shared / queryTokens.length >= 0.4) {
        matches.push(entry);
        if (matches.length >= 5) break; // cap result size
      }
    }

    return { hit: matches.length > 0, matches };
  } catch (err) {
    console.warn("[sanctions] screenName failed (non-fatal):", err);
    return { hit: false, matches: [] };
  }
}

/**
 * Screen a wallet address against known SDN wallet addresses.
 * OFAC's digital currency address list is separate; we do a simple exact-match
 * on the address string (case-insensitive hex comparison).
 *
 * Note: The full digital-currency address list requires a separate download.
 * This function is a placeholder that always returns { hit: false } until
 * that list is integrated. It is here to provide a clean API surface.
 */
export async function screenWallet(_address: string): Promise<ScreenResult> {
  // TODO: integrate OFAC digital currency address list when needed for mainnet
  return { hit: false, matches: [] };
}
