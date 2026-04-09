/**
 * Proof Enrichment Service
 * ========================
 * Runs 3 parallel checks BEFORE AI voting to add verifiable external evidence:
 *   1. Duplicate/recycled proof detection (cosine similarity on past labeled proofs)
 *   2. URL liveness verification (HTTP HEAD checks on URLs found in the proof text)
 *   3. GitHub repo analysis (language, last push, commits since contract start)
 *
 * All checks are fire-and-forget / best-effort. This service NEVER throws and NEVER
 * affects the main verification flow if it fails. An empty string means "no extra data".
 */

import { generateEmbedding, findSimilarProofs } from "./embedding.service";

// ─── Config ──────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 5_000;
const MAX_URLS = 5;

/** Similarity threshold above which a proof is flagged as a near-duplicate. */
const DUPLICATE_THRESHOLD = 0.95;
/** Similarity threshold above which a proof is flagged as suspicious. */
const SUSPICIOUS_THRESHOLD = 0.88;

// ─── URL helpers ─────────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

/** Extract and deduplicate URLs from text. Blocks localhost and private IP ranges. */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  const cleaned = matches
    .map((u) => u.replace(/[.,;:!?)\]]+$/, "")) // strip trailing punctuation
    .filter((u) => {
      try {
        const { hostname } = new URL(u);
        // Block localhost and RFC-1918 private ranges
        if (
          hostname === "localhost" ||
          /^127\./.test(hostname) ||
          /^10\./.test(hostname) ||
          /^192\.168\./.test(hostname) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        )
          return false;
        return true;
      } catch {
        return false;
      }
    });
  return [...new Set(cleaned)].slice(0, MAX_URLS);
}

// ─── URL liveness check ───────────────────────────────────────────────────────

interface UrlResult {
  url: string;
  live: boolean;
  status: number | null;
}

async function checkUrlLiveness(url: string): Promise<UrlResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "MilestoneFund-Verifier/1.0" },
    });
    return { url, live: res.ok, status: res.status };
  } catch {
    return { url, live: false, status: null };
  } finally {
    clearTimeout(timer);
  }
}

// ─── GitHub analysis ─────────────────────────────────────────────────────────

/** Returns a formatted summary string or null if the repo cannot be reached. */
async function analyzeGithubRepo(url: string, contractCreatedAt?: Date): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "github.com") return null;
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "MilestoneFund-Verifier/1.0",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const [repoRes, commitsRes] = await Promise.allSettled<Response | null>([
      fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
        signal: controller.signal,
      }),
      contractCreatedAt
        ? fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits?since=${contractCreatedAt.toISOString()}&per_page=1`,
            { headers, signal: controller.signal }
          )
        : Promise.resolve(null),
    ]);

    if (repoRes.status === "rejected" || !(repoRes.value instanceof Response) || !repoRes.value.ok) {
      return null;
    }

    type RepoData = { language?: string; pushed_at?: string; size?: number };
    const repoData = (await repoRes.value.json()) as RepoData;

    const lastPush = repoData.pushed_at ? new Date(repoData.pushed_at) : null;
    const daysSincePush = lastPush
      ? Math.floor((Date.now() - lastPush.getTime()) / 86_400_000)
      : null;

    let hasRecentCommits: boolean | null = null;
    if (
      contractCreatedAt &&
      commitsRes.status === "fulfilled" &&
      commitsRes.value instanceof Response &&
      commitsRes.value.ok
    ) {
      const commits = (await commitsRes.value.json()) as unknown[];
      hasRecentCommits = Array.isArray(commits) && commits.length > 0;
    }

    const lines: string[] = [`GitHub: ${owner}/${repo}`];
    if (repoData.language) lines.push(`  Language: ${repoData.language}`);
    if (daysSincePush !== null)
      lines.push(
        `  Last push: ${daysSincePush === 0 ? "today" : `${daysSincePush} day(s) ago`}`
      );
    if (hasRecentCommits !== null)
      lines.push(`  Has commits since contract start: ${hasRecentCommits ? "YES" : "NO"}`);
    if (repoData.size !== undefined) lines.push(`  Repo size: ${repoData.size} KB`);

    return lines.join("\n");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Build an enrichment context string to inject into AI verification prompts.
 * Runs all 3 checks in parallel; returns "" if all fail or nothing was found.
 * Never throws.
 */
export async function buildEnrichmentContext(params: {
  proofText: string;
  milestoneText: string;
  contractCreatedAt?: Date;
}): Promise<string> {
  try {
    const { proofText, milestoneText, contractCreatedAt } = params;

    // Extract URLs from both the proof text and milestone description
    const urls = extractUrls(`${proofText} ${milestoneText}`);
    const githubUrls = urls.filter((u) => {
      try {
        return new URL(u).hostname === "github.com";
      } catch {
        return false;
      }
    });

    // Run all 3 checks in parallel
    const [similarProofs, urlResults, githubResults] = await Promise.all([
      // 1. Duplicate detection via embedding similarity
      (async () => {
        const combinedText = `Milestone: ${milestoneText}\n\nProof:\n${proofText.slice(0, 2_000)}`;
        const embedding = await generateEmbedding(combinedText);
        if (!embedding) return [];
        return findSimilarProofs(embedding, 3);
      })(),

      // 2. URL liveness checks
      urls.length > 0
        ? Promise.allSettled(urls.map(checkUrlLiveness))
        : Promise.resolve([] as PromiseSettledResult<UrlResult>[]),

      // 3. GitHub repo analysis
      githubUrls.length > 0
        ? Promise.allSettled(githubUrls.map((u) => analyzeGithubRepo(u, contractCreatedAt)))
        : Promise.resolve([] as PromiseSettledResult<string | null>[]),
    ]);

    const sections: string[] = [];

    // ── Section 1: Duplicate/recycled proof warning ──────────────────────────
    const suspicious = similarProofs.filter(
      (s) => s.similarity >= SUSPICIOUS_THRESHOLD && ["REJECTED", "FAKED"].includes(s.label)
    );
    if (suspicious.length > 0) {
      const top = suspicious[0];
      const pct = Math.round(top.similarity * 100);
      if (top.similarity >= DUPLICATE_THRESHOLD) {
        sections.push(
          `DUPLICATE ALERT: This proof is ${pct}% similar to a previously ${top.label} proof ` +
            `(consensus ${top.consensusLevel}/5). This is a strong signal of fraud or recycling.`
        );
      } else {
        sections.push(
          `SIMILARITY WARNING: This proof is ${pct}% similar to a previously ${top.label} proof. ` +
            `This may indicate recycling or minimal modification.`
        );
      }
    }

    // ── Section 2: URL liveness ───────────────────────────────────────────────
    const urlChecks = urlResults
      .filter(
        (r): r is PromiseFulfilledResult<UrlResult> => r.status === "fulfilled"
      )
      .map((r) => r.value);
    if (urlChecks.length > 0) {
      const lines = urlChecks.map(
        (r) =>
          `  ${r.url} → ${r.live ? `LIVE (HTTP ${r.status})` : `NOT REACHABLE${r.status ? ` (HTTP ${r.status})` : ""}`}`
      );
      sections.push(`URL verification:\n${lines.join("\n")}`);
    }

    // ── Section 3: GitHub repo summary ───────────────────────────────────────
    const githubSummaries = githubResults
      .filter(
        (r): r is PromiseFulfilledResult<string> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
    if (githubSummaries.length > 0) {
      sections.push(githubSummaries.join("\n\n"));
    }

    if (sections.length === 0) return "";

    return (
      `\n\n[VERIFIED EXTERNAL DATA — independently collected by the verification server, not from the document]\n` +
      sections.join("\n\n") +
      `\n[END VERIFIED EXTERNAL DATA]`
    );
  } catch (err) {
    console.warn("[brain/enrichment] buildEnrichmentContext failed (non-fatal):", err);
    return "";
  }
}
