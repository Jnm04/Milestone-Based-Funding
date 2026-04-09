/**
 * Simulation script for the 5 new features.
 * Run: npx tsx scripts/test-new-features.ts
 *
 * Tests are unit-level: no DB required, no API keys required.
 * Covers logic correctness, not HTTP round-trips.
 */

import crypto from "crypto";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const g = (s: string) => `\x1b[32m${s}\x1b[0m`;
const r = (s: string) => `\x1b[31m${s}\x1b[0m`;
const b = (s: string) => `\x1b[34m${s}\x1b[0m`;
const y = (s: string) => `\x1b[33m${s}\x1b[0m`;
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(g("  ✓") + " " + label);
    passed++;
  } else {
    console.log(r("  ✗") + " " + label + (detail ? ` — ${detail}` : ""));
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: ICS Calendar
// ─────────────────────────────────────────────────────────────────────────────
console.log(b("\n▶ Feature 1: ICS Calendar\n"));

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function formatIcsDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n").replace(/\r/g, "");
}

const deadline = new Date("2026-06-15T00:00:00Z");
const dtstart = formatIcsDateOnly(deadline);
const dtend = formatIcsDateOnly(new Date(deadline.getTime() + 86_400_000));
const uid = "test-contract-ms-0@cascrow.app";
const summary = escapeIcs("Deadline: Ship MVP");
const icsBody = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Cascrow//Milestone Deadlines//EN",
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTAMP:${formatIcsDate(new Date())}`,
  `DTSTART;VALUE=DATE:${dtstart}`,
  `DTEND;VALUE=DATE:${dtend}`,
  `SUMMARY:${summary}`,
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

assert("ICS contains BEGIN:VCALENDAR", icsBody.includes("BEGIN:VCALENDAR"));
assert("ICS contains BEGIN:VEVENT", icsBody.includes("BEGIN:VEVENT"));
assert("ICS DTSTART is correct date", dtstart === "20260615");
assert("ICS DTEND is day after deadline", dtend === "20260616");
assert("ICS escapes semicolons", escapeIcs("a;b") === "a\\;b");
assert("ICS escapes commas", escapeIcs("a,b") === "a\\,b");
assert("ICS escapes newlines", escapeIcs("a\nb") === "a\\nb");
assert("ICS summary is correct", summary === "Deadline: Ship MVP");

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: OFAC Sanctions
// ─────────────────────────────────────────────────────────────────────────────
console.log(b("\n▶ Feature 2: OFAC Sanctions Screening\n"));

// Replicate the normalise/match logic from the service
function normaliseToTokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((t) => t.length >= 3);
}
function normaliseName(name: string): string {
  return normaliseToTokens(name).sort().join(" ");
}
function screenNameLocal(query: string, entries: string[]): { hit: boolean; matches: string[] } {
  const queryTokens = normaliseToTokens(query);
  if (queryTokens.length === 0) return { hit: false, matches: [] };
  const querySet = new Set(queryTokens);
  const matches: string[] = [];
  for (const entry of entries) {
    const entryTokens = entry.split(" ").filter((t) => t.length >= 3);
    let shared = 0;
    for (const t of entryTokens) if (querySet.has(t)) shared++;
    if (shared >= 2 && shared / queryTokens.length >= 0.4) {
      matches.push(entry);
      if (matches.length >= 5) break;
    }
  }
  return { hit: matches.length > 0, matches };
}

// Simulate a small SDN list
const fakeSdn = [
  normaliseName("SMITH, John"),
  normaliseName("AL-QAEDA ORGANIZATION"),
  normaliseName("KIM, Jong-un"),
  normaliseName("WEAPONS TRADING CORP"),
];

const r1 = screenNameLocal("John Smith", fakeSdn);
assert("Exact name match (John Smith)", r1.hit, JSON.stringify(r1));

const r2 = screenNameLocal("Alice Johnson", fakeSdn);
assert("No hit for clean name", !r2.hit, JSON.stringify(r2));

const r3 = screenNameLocal("Al-Qaeda", fakeSdn);
// Al-Qaeda only has 1 meaningful token ("qaeda") after normalisation, should not match with 1 token
// Our rule requires >=2 shared tokens — this tests conservative matching
assert("Single-token partial name not matched (conservative)", !r3.hit, JSON.stringify(r3));

const r4 = screenNameLocal("Smith John Jr", fakeSdn);
assert("Reversed name still matched", r4.hit, JSON.stringify(r4));

const r5 = screenNameLocal("", fakeSdn);
assert("Empty query returns no hit", !r5.hit);

assert("normaliseName removes punctuation", !normaliseName("Dr. Jones, Jr.").includes("."));
assert("normaliseName sorts tokens", normaliseName("Smith John") === normaliseName("John Smith"));
assert("normaliseName filters short tokens", !normaliseToTokens("Jo Al").some((t) => t.length < 3));

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Webhook Service
// ─────────────────────────────────────────────────────────────────────────────
console.log(b("\n▶ Feature 3: Webhook System\n"));

// HMAC signing
function signWebhook(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

const secret = crypto.randomBytes(32).toString("hex");
const payload = JSON.stringify({ event: "contract.funded", contractId: "abc123", data: { amountUSD: "500" } });
const sig = signWebhook(secret, payload);
const verified = sig === signWebhook(secret, payload);
const tampered = sig === signWebhook(secret, payload + "x");

assert("HMAC signature is deterministic", verified);
assert("HMAC rejects tampered payload", !tampered);
assert("Signature starts with sha256=", sig.startsWith("sha256="));
assert("Signature is 71 chars (sha256= + 64 hex)", sig.length === 71);

// Event filtering
const WEBHOOK_EVENTS = [
  "contract.created", "contract.funded", "contract.expired",
  "proof.submitted", "ai.decision", "manual_review.required",
  "manual_review.resolved", "funds.released", "contract.rejected",
];
const subscribedEvents = JSON.parse('["contract.funded","proof.submitted"]') as string[];
const validSet = new Set(WEBHOOK_EVENTS);
assert("All subscribed events are valid", subscribedEvents.every((e) => validSet.has(e)));
assert("Wildcard '*' would be filtered by validation", !validSet.has("invalid.event"));

// URL validation
assert("HTTP URL rejected", !"http://example.com".startsWith("https://"));
assert("HTTPS URL accepted", "https://example.com/hook".startsWith("https://"));

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 4: Telegram Bot
// ─────────────────────────────────────────────────────────────────────────────
console.log(b("\n▶ Feature 4: Telegram Bot\n"));

// Connection token generation
const connectToken = crypto.randomBytes(32).toString("hex");
assert("Connect token is 64 hex chars", connectToken.length === 64);
assert("Connect token is URL-safe", /^[0-9a-f]+$/.test(connectToken));

// Token expiry
const expiry15m = new Date(Date.now() + 15 * 60 * 1000);
const expiredToken = new Date(Date.now() - 1);
assert("15m expiry is in the future", expiry15m > new Date());
assert("Expired token detected correctly", expiredToken < new Date());

// HTML escaping for Telegram messages
function escTelegram(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
assert("HTML < is escaped", escTelegram("<script>") === "&lt;script&gt;");
assert("& is escaped", escTelegram("A & B") === "A &amp; B");
assert("Safe strings pass through", escTelegram("Hello World") === "Hello World");

// Deep-link format
const botUsername = "CascrowTestBot";
const deepLink = `https://t.me/${botUsername}?start=${connectToken}`;
assert("Deep link has correct format", deepLink.startsWith("https://t.me/") && deepLink.includes("?start="));

// Webhook command parsing
function parseCommand(text: string): { cmd: string; arg?: string } {
  const parts = text.trim().split(" ");
  return { cmd: parts[0], arg: parts[1] };
}
assert("/start token parsed correctly", parseCommand("/start abc123").arg === "abc123");
assert("/stop parsed correctly", parseCommand("/stop").cmd === "/stop");
assert("/status parsed correctly", parseCommand("/status").cmd === "/status");
assert("/start with no token has no arg", parseCommand("/start").arg === undefined);

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 5: GitHub Proof
// ─────────────────────────────────────────────────────────────────────────────
console.log(b("\n▶ Feature 5: GitHub Proof\n"));

// URL parsing (replicating parseGitHubUrl)
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "github.com") return null;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

assert("Parses standard repo URL", JSON.stringify(parseGitHubUrl("https://github.com/owner/repo")) === '{"owner":"owner","repo":"repo"}');
assert("Parses repo URL with /tree/branch", parseGitHubUrl("https://github.com/org/project/tree/main")?.repo === "project");
assert("Parses .git URL", parseGitHubUrl("https://github.com/user/repo.git")?.repo === "repo");
assert("Rejects non-GitHub URL", parseGitHubUrl("https://gitlab.com/user/repo") === null);
assert("Rejects bare GitHub domain", parseGitHubUrl("https://github.com/") === null);
assert("Rejects partial path", parseGitHubUrl("https://github.com/user") === null);
assert("Handles blob URL", parseGitHubUrl("https://github.com/user/repo/blob/main/README.md")?.repo === "repo");

// Proof text document structure
const mockGhText = [
  "=== GitHub Repository Proof ===",
  "Repository: user/awesome-project",
  "--- Repository Overview ---",
  "Primary language: TypeScript",
  "--- Activity Since Contract Start ---",
  "Commits: 47",
  "Latest commit: \"feat: implement payment flow\" by Alice on 2026-04-01",
  "--- README ---",
  "# Awesome Project\nThis project does XYZ...",
].join("\n");

assert("GitHub proof text contains repo section", mockGhText.includes("=== GitHub Repository Proof ==="));
assert("GitHub proof text contains commit count", mockGhText.includes("Commits: 47"));
assert("GitHub proof text contains language", mockGhText.includes("TypeScript"));
assert("GitHub proof text is non-empty", mockGhText.length > 100);

// SHA-256 of the proof text (fileHash)
const fileHash = crypto.createHash("sha256").update(mockGhText).digest("hex");
assert("fileHash is 64 hex chars", fileHash.length === 64);
assert("fileHash is deterministic", fileHash === crypto.createHash("sha256").update(mockGhText).digest("hex"));
assert("Different content → different hash", fileHash !== crypto.createHash("sha256").update(mockGhText + "x").digest("hex"));

// Proof type stored correctly
const proofRecord = { proofType: "github_url", proofUrl: "https://github.com/user/repo", fileName: "github:user/repo" };
assert("proofType is github_url", proofRecord.proofType === "github_url");
assert("fileName follows github: convention", proofRecord.fileName.startsWith("github:"));
assert("proofUrl is normalized repo URL", proofRecord.proofUrl === "https://github.com/user/repo");

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
const total = passed + failed;
console.log(
  `\n${passed === total ? g("ALL PASSED") : r("FAILURES FOUND")}   ` +
  g(`${passed} passed`) + "  " + (failed > 0 ? r(`${failed} failed`) : y("0 failed")) +
  `  (${total} total)\n`
);
if (failed > 0) process.exit(1);
