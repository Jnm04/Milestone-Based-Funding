import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCronSecret } from "@/lib/cron-auth";
import { sendRegulatoryAlertEmail } from "@/lib/email";
import Anthropic from "@anthropic-ai/sdk";

// Known regulatory RSS feeds for CSRD / ESRS / GRI
const RSS_FEEDS = [
  {
    source: "EUR-LEX",
    url: "https://eur-lex.europa.eu/rss/eurlexRecentPublications.xml",
    keywords: ["CSRD", "ESRS", "Corporate Sustainability Reporting"],
  },
  {
    source: "EFRAG",
    url: "https://www.efrag.org/rss",
    keywords: ["ESRS", "Sustainability Reporting", "CSRD"],
  },
];

const ESRS_TAGS = ["CSRD:E1", "CSRD:E2", "CSRD:E3", "CSRD:E4", "CSRD:E5", "CSRD:S1", "CSRD:S2", "CSRD:S3", "CSRD:S4", "CSRD:G1", "GRI:305", "GRI:302", "GRI:403", "GRI:401"];

interface FeedItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: string;
}

async function fetchRssFeed(feedUrl: string, source: string, keywords: string[]): Promise<FeedItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "cascrow-regulatory-monitor/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: FeedItem[] = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

      const title = titleMatch?.[1] ?? titleMatch?.[2] ?? "";
      const url = linkMatch?.[1] ?? "";
      const pubDateStr = pubDateMatch?.[1] ?? "";

      if (!title || !url) continue;

      const isRelevant = keywords.some(
        (kw) => title.toLowerCase().includes(kw.toLowerCase())
      );
      if (!isRelevant) continue;

      const publishedAt = pubDateStr ? new Date(pubDateStr) : new Date();
      if (isNaN(publishedAt.getTime())) continue;

      items.push({ title, url, publishedAt, source });
    }

    return items;
  } catch {
    return [];
  }
}

async function classifyWithAI(title: string, url: string): Promise<{
  affectedTags: string[];
  severity: "MINOR" | "MAJOR";
  aiSummary: string;
} | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `You are a regulatory compliance analyst specializing in EU sustainability reporting (CSRD/ESRS/GRI).
Analyze the given regulatory update title and classify it.

Respond with ONLY valid JSON in this exact format:
{
  "affectedTags": ["CSRD:E1"],
  "severity": "MINOR",
  "summary": "3-sentence summary of what changed and what companies need to do."
}

Available ESRS tags: ${ESRS_TAGS.join(", ")}
Severity: MAJOR = significant reporting requirement change, MINOR = clarification or guidance update.`,
      messages: [{
        role: "user",
        content: `Title: ${title}\nURL: ${url}`,
      }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    const parsed = JSON.parse(text) as { affectedTags: string[]; severity: "MINOR" | "MAJOR"; summary: string };

    // Track API usage
    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd: (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "regulatory-classification",
      },
    }).catch(() => {});

    return {
      affectedTags: Array.isArray(parsed.affectedTags) ? parsed.affectedTags : [],
      severity: parsed.severity === "MAJOR" ? "MAJOR" : "MINOR",
      aiSummary: parsed.summary ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/cron/regulatory-alerts
 * Weekly Monday 08:00 UTC — fetches CSRD/ESRS regulatory RSS feeds,
 * classifies new updates with Claude Haiku, and notifies affected enterprise users.
 */
export async function GET(request: NextRequest) {
  if (!isValidCronSecret(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let newAlerts = 0;
  let notified = 0;

  for (const feed of RSS_FEEDS) {
    const items = await fetchRssFeed(feed.url, feed.source, feed.keywords);

    for (const item of items) {
      // Check if we've already processed this URL
      const existing = await prisma.regulatoryAlert.findFirst({
        where: { url: item.url },
      });
      if (existing) continue;

      // Classify with AI
      const classification = await classifyWithAI(item.title, item.url);
      if (!classification) continue;

      // Save to DB
      const alert = await prisma.regulatoryAlert.create({
        data: {
          source: item.source,
          title: item.title,
          url: item.url,
          affectedTags: classification.affectedTags,
          severity: classification.severity,
          aiSummary: classification.aiSummary,
          publishedAt: item.publishedAt,
        },
      });
      newAlerts++;

      if (classification.affectedTags.length === 0) continue;

      // Find enterprise users with attestations tagged to affected ESRS topics
      const milestoneTagPatterns = classification.affectedTags.map((tag) =>
        `%${tag.replace("CSRD:", "CSRD:")}%`
      );

      const affectedMilestones = await prisma.milestone.findMany({
        where: {
          OR: milestoneTagPatterns.map((pattern) => ({
            regulatoryTags: { contains: pattern.replace(/%/g, "") },
          })),
          status: { notIn: ["COMPLETED", "EXPIRED"] },
        },
        include: {
          contract: {
            include: { investor: { select: { id: true, email: true, isEnterprise: true } } },
          },
        },
      });

      // Group by investor to avoid duplicate emails
      const notifiedUsers = new Set<string>();
      for (const milestone of affectedMilestones) {
        const investor = milestone.contract.investor;
        if (!investor.isEnterprise || notifiedUsers.has(investor.id)) continue;
        notifiedUsers.add(investor.id);

        // Find all affected goal titles for this user
        const userGoals = affectedMilestones
          .filter((m) => m.contract.investorId === investor.id)
          .map((m) => m.title);

        await sendRegulatoryAlertEmail({
          to: investor.email,
          alertTitle: alert.title,
          source: alert.source,
          severity: alert.severity as "MINOR" | "MAJOR",
          aiSummary: alert.aiSummary,
          affectedGoals: userGoals,
          url: alert.url,
        });

        // Also fire Slack/Teams notification
        const { fireIntegrationNotification } = await import("@/services/notifications/integrations.service");
        void fireIntegrationNotification(
          investor.id,
          "regulatory.alert",
          `${alert.severity === "MAJOR" ? "⚠️ " : ""}${alert.source} update: ${alert.title}\n${classification.aiSummary.slice(0, 200)}`,
          `Regulatory update: ${alert.title}`
        );

        notified++;
      }
    }
  }

  return NextResponse.json({ newAlerts, notified, timestamp: new Date().toISOString() });
}
