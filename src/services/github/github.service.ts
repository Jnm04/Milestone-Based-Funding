/**
 * GitHub Proof Service
 * ====================
 * Fetches structured data from a GitHub repository URL to use as AI-verifiable
 * proof of milestone completion.
 *
 * Instead of uploading a PDF, the receiver can submit a GitHub repo URL.
 * This service queries the GitHub REST API and builds a rich text document that
 * the 5-model AI panel can evaluate against the milestone criteria.
 *
 * Data fetched (all from public GitHub API):
 *  - Repo metadata: description, language, stars, topics, visibility
 *  - Activity since contract start: commit count, latest commit message + author
 *  - Open issues and PRs count
 *  - README contents (up to 8,000 chars)
 *  - Repository tree (top-level files/dirs, up to 60 entries)
 *  - Latest release (if any)
 *
 * Rate limits:
 *  - Unauthenticated: 60 req/h per IP
 *  - With GITHUB_TOKEN: 5,000 req/h
 *  → Set GITHUB_TOKEN in .env.local (personal access token, read:public_repo scope)
 *
 * This function never throws — returns null on any failure.
 */

const FETCH_TIMEOUT_MS = 10_000;

interface GitHubHeaders {
  Accept: string;
  "User-Agent": string;
  Authorization?: string;
}

function githubHeaders(): GitHubHeaders {
  const h: GitHubHeaders = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Cascrow-Verifier/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function ghFetch(url: string, signal: AbortSignal): Promise<Response> {
  return fetch(url, { headers: githubHeaders(), signal });
}

export interface GitHubProofDocument {
  /** The normalised repo URL */
  repoUrl: string;
  /** Full text document to pass to AI verifiers */
  text: string;
  /** SHA-256 hash of the full text (used as fileHash in the DB) */
}

/**
 * Parse a GitHub URL and return { owner, repo } or null if invalid.
 * Accepts:
 *  - https://github.com/owner/repo
 *  - https://github.com/owner/repo/tree/branch
 *  - https://github.com/owner/repo/blob/main/README.md
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
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

/**
 * Fetch repository data and build a structured proof text document.
 * Returns null if the repo is not accessible (private, 404, etc.).
 */
export async function fetchGitHubProof(
  repoUrl: string,
  contractCreatedAt?: Date
): Promise<GitHubProofDocument | null> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) return null;
  const { owner, repo } = parsed;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // ── 1. Repo metadata ──────────────────────────────────────────────────────
    const repoRes = await ghFetch(apiBase, controller.signal);
    if (!repoRes.ok) {
      if (repoRes.status === 404) return null; // private or non-existent
      throw new Error(`GitHub API ${repoRes.status}`);
    }

    type RepoData = {
      full_name?: string;
      description?: string;
      language?: string;
      stargazers_count?: number;
      open_issues_count?: number;
      pushed_at?: string;
      created_at?: string;
      topics?: string[];
      default_branch?: string;
      size?: number;
      visibility?: string;
      has_issues?: boolean;
      has_wiki?: boolean;
      homepage?: string;
      license?: { name?: string };
    };
    const repoData = (await repoRes.json()) as RepoData;

    // ── 2. Commits since contract start ───────────────────────────────────────
    let commitCount = 0;
    let latestCommit: { message: string; author: string; date: string } | null = null;

    const since = contractCreatedAt?.toISOString() ?? "";
    const commitsUrl = `${apiBase}/commits?per_page=100${since ? `&since=${since}` : ""}`;
    const commitsRes = await ghFetch(commitsUrl, controller.signal);
    if (commitsRes.ok) {
      type CommitItem = {
        commit?: {
          message?: string;
          author?: { name?: string; date?: string };
        };
      };
      const commits = (await commitsRes.json()) as CommitItem[];
      commitCount = Array.isArray(commits) ? commits.length : 0;
      if (commitCount > 0 && commits[0]?.commit) {
        latestCommit = {
          message: commits[0].commit.message?.split("\n")[0] ?? "",
          author: commits[0].commit.author?.name ?? "unknown",
          date: commits[0].commit.author?.date ?? "",
        };
      }
    }

    // ── 3. README ─────────────────────────────────────────────────────────────
    let readmeText = "";
    const readmeRes = await ghFetch(`${apiBase}/readme`, controller.signal);
    if (readmeRes.ok) {
      type ReadmeData = { content?: string; encoding?: string };
      const readmeData = (await readmeRes.json()) as ReadmeData;
      if (readmeData.content && readmeData.encoding === "base64") {
        const decoded = Buffer.from(readmeData.content.replace(/\n/g, ""), "base64").toString(
          "utf-8"
        );
        readmeText = decoded.slice(0, 8_000); // cap to avoid token overflow
      }
    }

    // ── 4. Repository file tree (top-level) ───────────────────────────────────
    let fileTree = "";
    const branch = repoData.default_branch ?? "main";
    const treeRes = await ghFetch(
      `${apiBase}/git/trees/${branch}?recursive=0`,
      controller.signal
    );
    if (treeRes.ok) {
      type TreeData = { tree?: { path?: string; type?: string }[] };
      const treeData = (await treeRes.json()) as TreeData;
      if (Array.isArray(treeData.tree)) {
        fileTree = treeData.tree
          .slice(0, 60)
          .map((n) => `${n.type === "tree" ? "📁" : "📄"} ${n.path}`)
          .join("\n");
      }
    }

    // ── 5. Latest release ─────────────────────────────────────────────────────
    let latestRelease = "";
    const releaseRes = await ghFetch(`${apiBase}/releases/latest`, controller.signal);
    if (releaseRes.ok) {
      type ReleaseData = { tag_name?: string; name?: string; published_at?: string; body?: string };
      const release = (await releaseRes.json()) as ReleaseData;
      if (release.tag_name) {
        latestRelease = [
          `Tag: ${release.tag_name}`,
          release.name ? `Name: ${release.name}` : null,
          release.published_at ? `Published: ${release.published_at}` : null,
          release.body ? `Notes: ${release.body.slice(0, 500)}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }

    // ── Compose document ──────────────────────────────────────────────────────
    const lines: string[] = [
      `=== GitHub Repository Proof ===`,
      `Repository: ${owner}/${repo}`,
      `URL: https://github.com/${owner}/${repo}`,
      ``,
      `--- Repository Overview ---`,
      `Full name: ${repoData.full_name ?? `${owner}/${repo}`}`,
      repoData.description ? `Description: ${repoData.description}` : null,
      repoData.language ? `Primary language: ${repoData.language}` : null,
      repoData.topics?.length ? `Topics: ${repoData.topics.join(", ")}` : null,
      repoData.visibility ? `Visibility: ${repoData.visibility}` : null,
      repoData.size !== undefined ? `Size: ${repoData.size} KB` : null,
      repoData.stargazers_count !== undefined ? `Stars: ${repoData.stargazers_count}` : null,
      repoData.open_issues_count !== undefined
        ? `Open issues/PRs: ${repoData.open_issues_count}`
        : null,
      repoData.created_at ? `Created: ${repoData.created_at}` : null,
      repoData.pushed_at ? `Last pushed: ${repoData.pushed_at}` : null,
      repoData.homepage ? `Homepage: ${repoData.homepage}` : null,
      repoData.license?.name ? `License: ${repoData.license.name}` : null,
      ``,
    ].filter((l): l is string => l !== null);

    // Commits section
    lines.push(`--- Activity ${contractCreatedAt ? `Since Contract Start (${contractCreatedAt.toISOString()})` : ""} ---`);
    lines.push(`Commits: ${commitCount}${commitCount === 100 ? "+" : ""}`);
    if (latestCommit) {
      lines.push(`Latest commit: "${latestCommit.message}" by ${latestCommit.author} on ${latestCommit.date}`);
    }
    lines.push(``);

    // File tree
    if (fileTree) {
      lines.push(`--- Top-Level Files ---`);
      lines.push(fileTree);
      lines.push(``);
    }

    // Latest release
    if (latestRelease) {
      lines.push(`--- Latest Release ---`);
      lines.push(latestRelease);
      lines.push(``);
    }

    // README
    if (readmeText) {
      lines.push(`--- README ---`);
      lines.push(readmeText);
    }

    const text = lines.join("\n").trim();
    const normalizedUrl = `https://github.com/${owner}/${repo}`;

    return { repoUrl: normalizedUrl, text };
  } catch (err) {
    console.warn(`[github] fetchGitHubProof failed for ${repoUrl} (non-fatal):`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
