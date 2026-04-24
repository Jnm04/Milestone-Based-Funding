import { NextRequest, NextResponse } from "next/server";
import { isInternalAuthorized } from "@/lib/internal-auth";
import Anthropic from "@anthropic-ai/sdk";
import { verifyMilestone } from "@/services/ai/verifier.service";

export const maxDuration = 60;


// ─── Synthetic generation ─────────────────────────────────────────────────────

const DOMAIN_CONTEXT: Record<string, string> = {
  legal:     "legal compliance, GDPR assessments, MDR classification, data protection, privacy policies, regulatory filings",
  technical: "software MVP delivery, API deployment, mobile app launch, GitHub repository, working prototype, code delivery",
  business:  "revenue milestones, user signups, B2B partnerships, pilot customers, sales targets, market traction",
  research:  "literature review, feasibility study, market research, user interviews, academic report, competitive analysis",
};

const OUTCOME_INSTRUCTION: Record<string, string> = {
  approved: "The proof document CLEARLY demonstrates the milestone was completed. Include specific dates, results, and deliverables.",
  rejected: "The proof is a concept document, plan, or research summary — NOT completed work. The milestone is NOT met.",
  mixed:    "The proof partially meets the milestone. Some criteria are met, others are missing or only planned.",
};

async function generateOnePair(params: {
  domain: string;
  outcome: string;
  index: number;
}): Promise<{ milestoneText: string; proofText: string } | null> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const companies = ["Nexora GmbH", "BluePath Technologies", "VerdeTech UG", "Arkana Systems", "Solveig Labs",
      "Luminos AG", "DataVault GmbH", "CoreShift Ltd", "Pinnacle Soft", "Aether Dynamics"];
    const company = companies[(params.index * 3 + params.domain.length) % companies.length];
    const month = ["January","February","March","April"][params.index % 4];

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: `You generate realistic startup documents for a milestone verification training dataset.
Always return ONLY valid JSON. No markdown, no explanation outside the JSON.`,
      messages: [{
        role: "user",
        content: `Generate one realistic milestone+proof pair.

Company: ${company}
Date: ${month} 2026
Domain: ${DOMAIN_CONTEXT[params.domain] ?? params.domain}
Outcome requirement: ${OUTCOME_INSTRUCTION[params.outcome] ?? OUTCOME_INSTRUCTION.mixed}

Return ONLY this JSON structure (keep proofText under 400 words to stay within limits):
{
  "milestoneText": "2-3 sentence milestone description with specific, measurable deliverable",
  "proofText": "200-400 word realistic proof document matching the company and domain"
}`,
      }],
    });

    const raw = msg.content[0];
    if (raw.type !== "text") return null;
    // Strip markdown code fences if present
    const cleaned = raw.text.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
    // Extract JSON object if there's surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[generate] no JSON object found in response:", cleaned.slice(0, 200));
      return null;
    }
    const parsed = JSON.parse(jsonMatch[0]) as { milestoneText: string; proofText: string };
    if (!parsed.milestoneText || !parsed.proofText) return null;
    return parsed;
  } catch (err) {
    console.error("[generate] synthetic pair failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── arXiv fetcher ────────────────────────────────────────────────────────────

interface PublicPair {
  milestoneText: string;
  proofText: string;
  sourceUrl: string;
  sourceTitle: string;
}

async function fetchArxivPairs(keyword: string, count: number, outcome: string): Promise<PublicPair[]> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(keyword)}&max_results=${count}&sortBy=relevance&sortOrder=descending`;
  const res = await fetch(url, { headers: { "User-Agent": "MilestoneFund-Trainer/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const xml = await res.text();
  const entries: PublicPair[] = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null && entries.length < count) {
    const entry = match[1];
    const title   = /<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]?.replace(/\s+/g," ").trim() ?? "";
    const abstract = /<summary>([\s\S]*?)<\/summary>/.exec(entry)?.[1]?.replace(/\s+/g," ").trim() ?? "";
    const arxivId  = /<id>([\s\S]*?)<\/id>/.exec(entry)?.[1]?.trim() ?? "";
    if (!title || !abstract || abstract.length < 100) continue;

    const milestone = await generateMilestoneForDocument({ title, proofText: abstract, outcome });
    entries.push({
      milestoneText: milestone,
      proofText: `${title}\n\n${abstract}`,
      sourceUrl: arxivId,
      sourceTitle: title.slice(0, 80),
    });
  }
  return entries;
}

// ─── GitHub fetcher ───────────────────────────────────────────────────────────

async function fetchGithubPairs(keyword: string, count: number, outcome: string): Promise<PublicPair[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "MilestoneFund-Trainer/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const searchRes = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&per_page=${Math.min(count * 2, 10)}`,
    { headers, signal: AbortSignal.timeout(8000) }
  );
  if (!searchRes.ok) return [];

  const searchData = await searchRes.json() as { items: { full_name: string; description: string; html_url: string; default_branch: string }[] };
  const repos = searchData.items ?? [];

  const pairs: PublicPair[] = [];
  for (const repo of repos) {
    if (pairs.length >= count) break;
    try {
      const branch = repo.default_branch ?? "main";
      const readmeRes = await fetch(
        `https://raw.githubusercontent.com/${repo.full_name}/${branch}/README.md`,
        { headers: { "User-Agent": "MilestoneFund-Trainer/1.0" }, signal: AbortSignal.timeout(5000) }
      );
      if (!readmeRes.ok) continue;

      const readme = (await readmeRes.text()).slice(0, 3000);
      if (readme.length < 200) continue;

      const milestone = await generateMilestoneForDocument({
        title: repo.full_name,
        proofText: readme,
        outcome,
      });
      pairs.push({
        milestoneText: milestone,
        proofText: readme,
        sourceUrl: repo.html_url,
        sourceTitle: repo.full_name,
      });
    } catch {
      continue;
    }
  }
  return pairs;
}

// ─── Generate milestone for a real document ───────────────────────────────────

function fallbackMilestone(title: string, outcome: string): string {
  if (outcome === "rejected") {
    return `The team must deliver a fully completed and deployed implementation of ${title}. All core features must be live and user-facing, not merely planned or documented.`;
  }
  if (outcome === "approved") {
    return `The team must deliver a complete, working implementation of ${title} with all stated objectives met. Results, metrics, or deliverables must be explicitly documented and verifiable.`;
  }
  return `The team must deliver a working prototype or functional version of ${title}. Core features must be implemented; some secondary items may remain in progress.`;
}

async function generateMilestoneForDocument(params: {
  title: string;
  proofText: string;
  outcome: string;
}): Promise<string> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return fallbackMilestone(params.title, params.outcome);
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { title, proofText, outcome } = params;

    const instruction = outcome === "approved"
      ? "Write a milestone that this document CLEARLY satisfies."
      : outcome === "rejected"
      ? "Write a milestone that asks for completed work — but this document is only a plan/concept so it does NOT satisfy it."
      : "Write a milestone that this document partially satisfies.";

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: "You generate concise milestone descriptions for startup verification. Return ONLY the milestone text, no JSON, no explanation.",
      messages: [{
        role: "user",
        content: `Document title: ${title}\nDocument excerpt: ${proofText.slice(0, 600)}\n\nInstruction: ${instruction}\n\nWrite a 2-3 sentence milestone description that is specific and measurable:`,
      }],
    });

    const raw = msg.content[0];
    return raw.type === "text" && raw.text.trim() ? raw.text.trim() : fallbackMilestone(title, outcome);
  } catch {
    return fallbackMilestone(params.title, params.outcome);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { mode?: string; domain?: string; outcome?: string; count?: number; source?: string; keyword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { mode, domain, outcome, count, source, keyword } = body;

  const safeCount = Math.min(Math.max(1, count ?? 3), 5);

  let pairs: Array<{ milestoneText: string; proofText: string; sourceUrl?: string; sourceTitle?: string }> = [];

  if (mode === "synthetic") {
    const generated = await Promise.all(
      Array.from({ length: safeCount }, (_, i) =>
        generateOnePair({ domain: domain ?? "technical", outcome: outcome ?? "mixed", index: i })
      )
    );
    pairs = generated.filter((p): p is NonNullable<typeof p> => p !== null);
  } else {
    if (!keyword) return NextResponse.json({ error: "keyword required for public mode" }, { status: 400 });
    pairs = source === "github"
      ? await fetchGithubPairs(keyword, safeCount, outcome ?? "mixed")
      : await fetchArxivPairs(keyword, safeCount, outcome ?? "mixed");
  }

  if (pairs.length === 0) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server." }, { status: 422 });
    }
    const msg = mode === "synthetic"
      ? "Generation failed — Claude returned invalid JSON or empty response. Try again."
      : source === "github"
      ? `No GitHub repos found for "${keyword}". Try a different keyword.`
      : `No arXiv papers found for "${keyword}". Try a different keyword or check your connection.`;
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // Run all verifications in parallel
  const results = await Promise.all(
    pairs.map(async (pair) => {
      try {
        const result = await verifyMilestone({
          milestone: pair.milestoneText,
          extractedText: pair.proofText,
        });
        return {
          milestoneText: pair.milestoneText,
          proofText: pair.proofText,
          sourceUrl: pair.sourceUrl ?? null,
          sourceTitle: pair.sourceTitle ?? null,
          decision: result.decision,
          reasoning: result.reasoning,
          confidence: result.confidence,
          modelVotes: result.modelVotes,
          consensusLevel: result.consensusLevel,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json({ results: results.filter(Boolean) });
}
