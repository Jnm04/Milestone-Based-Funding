import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/dashboard/investor/transparency-report
 *
 * Generates a formal quarterly stakeholder transparency report as an HTML document
 * stored in Vercel Blob. Cached per quarter — same period returns the cached URL.
 *
 * Body: { quarter: "Q1"|"Q2"|"Q3"|"Q4", year: number }
 * Response: { reportUrl: string, cached: boolean, period: string }
 */

const HAIKU_INPUT_PER_M  = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// Quarter → [start, end] date range
function quarterRange(q: "Q1" | "Q2" | "Q3" | "Q4", year: number): [Date, Date] {
  const ranges: Record<string, [number, number, number, number]> = {
    Q1: [0,  1,  3,  30],
    Q2: [3,  1,  6,  29],
    Q3: [6,  1,  9,  30],
    Q4: [9,  1,  12, 31],
  };
  const [sM, sD, eM, eD] = ranges[q];
  const start = new Date(Date.UTC(year, sM,  sD,  0,  0,  0, 0));
  const end   = new Date(Date.UTC(year, eM - 1, eD, 23, 59, 59, 999));
  return [start, end];
}

function quarterLabel(q: string, year: number): string {
  const names: Record<string, string> = {
    Q1: "January 1 – March 31",
    Q2: "April 1 – June 30",
    Q3: "July 1 – September 30",
    Q4: "October 1 – December 31",
  };
  return names[q] ?? q;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "INVESTOR") {
      return NextResponse.json({ error: "Investor access required" }, { status: 403 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
    }

    // Rate limit: 4 per 24h
    if (!(await checkRateLimit(`transparency-report:${session.user.id}`, 4, 24 * 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Daily report limit reached. You can generate up to 4 reports per day." },
        { status: 429, headers: { "Retry-After": "86400" } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { quarter, year } = body as { quarter?: string; year?: unknown };

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter ?? "")) {
      return NextResponse.json({ error: "quarter must be one of: Q1, Q2, Q3, Q4" }, { status: 400 });
    }
    const q = quarter as "Q1" | "Q2" | "Q3" | "Q4";
    const y = typeof year === "number" && year >= 2020 && year <= 2099 ? year : new Date().getUTCFullYear();
    const periodKey = `${q}-${y}`;

    // ── Cache check ──────────────────────────────────────────────────────────
    const investor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        companyName: true,
        email: true,
        lastTransparencyReportUrl: true,
        lastTransparencyReportPeriod: true,
      },
    });
    if (!investor) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (
      investor.lastTransparencyReportPeriod === periodKey &&
      investor.lastTransparencyReportUrl
    ) {
      return NextResponse.json({
        reportUrl: investor.lastTransparencyReportUrl,
        cached: true,
        period: periodKey,
      });
    }

    // ── Fetch contracts for this quarter ─────────────────────────────────────
    const [quarterStart, quarterEnd] = quarterRange(q, y);

    const contracts = await prisma.contract.findMany({
      where: {
        investorId: session.user.id,
        OR: [
          { createdAt: { gte: quarterStart, lte: quarterEnd } },
          { milestones: { some: { updatedAt: { gte: quarterStart, lte: quarterEnd } } } },
        ],
      },
      include: {
        startup: { select: { name: true, companyName: true } },
        milestones: {
          orderBy: { order: "asc" },
          select: {
            title: true,
            amountUSD: true,
            status: true,
            cancelAfter: true,
            updatedAt: true,
            order: true,
            proofs: {
              where: { aiDecision: "YES" },
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { aiConfidence: true, aiReasoning: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Build structured portfolio data ───────────────────────────────────────
    const allMilestones = contracts.flatMap((c) => c.milestones);
    const completedMilestones = allMilestones.filter((m) => m.status === "COMPLETED");
    const rejectedMilestones  = allMilestones.filter((m) => m.status === "REJECTED");
    const expiredMilestones   = allMilestones.filter((m) => m.status === "EXPIRED");
    const activeMilestones    = allMilestones.filter((m) =>
      !["COMPLETED", "REJECTED", "EXPIRED", "PENDING"].includes(m.status)
    );

    const totalDeployed = contracts.reduce((s, c) => s + Number(c.amountUSD), 0);
    const totalReleased = completedMilestones.reduce((s, m) => s + Number(m.amountUSD), 0);

    const confidenceScores = completedMilestones
      .map((m) => m.proofs[0]?.aiConfidence)
      .filter((n): n is number => typeof n === "number");
    const avgConfidence =
      confidenceScores.length > 0
        ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
        : null;

    const contractsSummary = contracts.map((c) => ({
      id: c.id,
      title: c.milestone,
      startup: c.startup?.companyName ?? c.startup?.name ?? "Unknown Startup",
      status: c.status,
      totalAmountUSD: Number(c.amountUSD),
      createdAt: c.createdAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      milestones: c.milestones.map((m) => ({
        title: m.title,
        amountUSD: Number(m.amountUSD),
        status: m.status,
        deadline: m.cancelAfter.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        completedAt:
          m.status === "COMPLETED"
            ? m.updatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : null,
        onTime: m.status === "COMPLETED" ? m.updatedAt <= m.cancelAfter : null,
        aiConfidence: m.proofs[0]?.aiConfidence ?? null,
      })),
    }));

    // ── Haiku: generate executive narrative ──────────────────────────────────
    const portfolioContext = JSON.stringify({
      period: `${q} ${y}`,
      dateRange: quarterLabel(q, y) + `, ${y}`,
      investorName: investor.companyName ?? investor.name ?? "the investor",
      totalContracts: contracts.length,
      milestonesCompleted: completedMilestones.length,
      milestonesActive: activeMilestones.length,
      milestonesRejected: rejectedMilestones.length,
      milestonesExpired: expiredMilestones.length,
      totalDeployedUSD: totalDeployed,
      totalReleasedUSD: totalReleased,
      avgAiConfidencePct: avgConfidence,
      contracts: contractsSummary.map((c) => ({
        title: c.title,
        startup: c.startup,
        status: c.status,
        amountUSD: c.totalAmountUSD,
        milestoneCount: c.milestones.length,
        completedMilestones: c.milestones.filter((m) => m.status === "COMPLETED").length,
      })),
    }, null, 2);

    const anthropic = getAnthropic();
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `You are a grant portfolio reporting assistant for cascrow, an AI-powered escrow platform.
Generate a formal, professional executive narrative paragraph for a quarterly stakeholder transparency report.
Write in third person. Be factual, data-grounded, and concise (3-5 sentences).
Tone: formal, suitable for board, donor, or DAO voter review.
Mention key figures (amounts, completion rates, AI confidence if available).
Do NOT use markdown — plain prose only. Do NOT use bullet points.
Respond with ONLY the narrative paragraph as plain text.`,
      messages: [
        {
          role: "user",
          content: `Portfolio data for the transparency report:\n${portfolioContext}`,
        },
      ],
    });

    // Track usage (non-blocking)
    const inputTokens  = msg.usage?.input_tokens  ?? 0;
    const outputTokens = msg.usage?.output_tokens ?? 0;
    prisma.apiUsage.create({
      data: {
        model: "claude-haiku-4-5-20251001",
        inputTokens,
        outputTokens,
        estimatedCostUsd:
          (inputTokens  / 1_000_000) * HAIKU_INPUT_PER_M +
          (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M,
        context: "transparency-report",
      },
    }).catch(() => {});

    const narrative =
      msg.content[0]?.type === "text" && msg.content[0].text.trim().length > 10
        ? msg.content[0].text.trim()
        : `During ${q} ${y}, ${investor.companyName ?? investor.name ?? "the investor"} deployed $${totalDeployed.toLocaleString()} RLUSD across ${contracts.length} contract${contracts.length !== 1 ? "s" : ""} on the cascrow platform. ${completedMilestones.length} milestone${completedMilestones.length !== 1 ? "s were" : " was"} verified and completed, with $${totalReleased.toLocaleString()} RLUSD released to recipient startups. All verification decisions were rendered by cascrow's 5-model AI consensus engine.`;

    // ── Generate HTML report ──────────────────────────────────────────────────
    const reportId = `RPT-${y}${q}-${session.user.id.slice(0, 8).toUpperCase()}`;
    const generatedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const periodFull = `${q} ${y} · ${quarterLabel(q, y)}, ${y}`;

    const html = buildReportHtml({
      reportId,
      period: periodFull,
      quarter: q,
      year: y,
      generatedAt,
      investorName: investor.companyName ?? investor.name ?? investor.email,
      narrative,
      contracts: contractsSummary,
      stats: {
        totalContracts: contracts.length,
        milestonesCompleted: completedMilestones.length,
        milestonesActive: activeMilestones.length,
        milestonesRejectedOrExpired: rejectedMilestones.length + expiredMilestones.length,
        totalDeployedUSD: totalDeployed,
        totalReleasedUSD: totalReleased,
        avgConfidence,
      },
    });

    // Delete the previous report blob for this period to prevent stale reports
    // from remaining publicly accessible after regeneration.
    if (
      investor.lastTransparencyReportUrl &&
      investor.lastTransparencyReportPeriod === periodKey
    ) {
      await del(investor.lastTransparencyReportUrl).catch(() => {});
    }

    // ── Upload to Vercel Blob ─────────────────────────────────────────────────
    const blobPath = `reports/${session.user.id}/${periodKey}-${Date.now()}.html`;
    const blob = await put(blobPath, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
    });
    const reportUrl = blob.url;

    // ── Cache in DB ───────────────────────────────────────────────────────────
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastTransparencyReportUrl: reportUrl,
        lastTransparencyReportPeriod: periodKey,
      },
    });

    return NextResponse.json({ reportUrl, cached: false, period: periodKey });
  } catch (err) {
    console.error("[transparency-report] Error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// ─── HTML Report Builder ────────────────────────────────────────────────────

interface ReportContract {
  id: string;
  title: string;
  startup: string;
  status: string;
  totalAmountUSD: number;
  createdAt: string;
  milestones: {
    title: string;
    amountUSD: number;
    status: string;
    deadline: string;
    completedAt: string | null;
    onTime: boolean | null;
    aiConfidence: number | null;
  }[];
}

interface ReportStats {
  totalContracts: number;
  milestonesCompleted: number;
  milestonesActive: number;
  milestonesRejectedOrExpired: number;
  totalDeployedUSD: number;
  totalReleasedUSD: number;
  avgConfidence: number | null;
}

interface BuildParams {
  reportId: string;
  period: string;
  quarter: string;
  year: number;
  generatedAt: string;
  investorName: string;
  narrative: string;
  contracts: ReportContract[];
  stats: ReportStats;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function usd(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function milestoneStatusLabel(s: string): string {
  const labels: Record<string, string> = {
    PENDING:           "Pending",
    AWAITING_ESCROW:   "Awaiting Escrow",
    FUNDED:            "Funded",
    PROOF_SUBMITTED:   "Proof Submitted",
    PENDING_REVIEW:    "Pending Review",
    VERIFIED:          "Verified",
    REJECTED:          "Rejected",
    RENEGOTIATING:     "Renegotiating",
    EXPIRED:           "Expired",
    COMPLETED:         "Completed",
  };
  return labels[s] ?? s;
}

function milestoneStatusBadge(s: string): string {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    COMPLETED:       { bg: "rgba(22,163,74,0.10)",   color: "#16a34a", border: "rgba(22,163,74,0.25)"  },
    VERIFIED:        { bg: "rgba(22,163,74,0.07)",   color: "#16a34a", border: "rgba(22,163,74,0.2)"   },
    FUNDED:          { bg: "rgba(59,130,246,0.08)",  color: "#3b82f6", border: "rgba(59,130,246,0.2)"  },
    PROOF_SUBMITTED: { bg: "rgba(168,85,247,0.08)",  color: "#a855f7", border: "rgba(168,85,247,0.2)"  },
    PENDING_REVIEW:  { bg: "rgba(245,158,11,0.10)",  color: "#d97706", border: "rgba(245,158,11,0.25)" },
    REJECTED:        { bg: "rgba(220,38,38,0.08)",   color: "#dc2626", border: "rgba(220,38,38,0.2)"   },
    EXPIRED:         { bg: "rgba(100,116,139,0.10)", color: "#64748b", border: "rgba(100,116,139,0.2)" },
    RENEGOTIATING:   { bg: "rgba(245,158,11,0.10)",  color: "#d97706", border: "rgba(245,158,11,0.2)"  },
    AWAITING_ESCROW: { bg: "rgba(245,158,11,0.08)",  color: "#d97706", border: "rgba(245,158,11,0.2)"  },
    PENDING:         { bg: "rgba(100,116,139,0.08)", color: "#64748b", border: "rgba(100,116,139,0.2)" },
  };
  const c = map[s] ?? map["PENDING"];
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:700;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.06em;background:${c.bg};color:${c.color};border:1px solid ${c.border};">${esc(milestoneStatusLabel(s))}</span>`;
}

function contractStatusBadge(s: string): string {
  return milestoneStatusBadge(s);
}

function buildContractsSection(contracts: ReportContract[]): string {
  if (contracts.length === 0) {
    return `<p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a7d72;font-style:italic;">No contracts recorded during this period.</p>`;
  }

  return contracts
    .map((c, idx) => {
      const startupLine = esc(c.startup);
      const amountLine  = `${usd(c.totalAmountUSD)} RLUSD`;
      const shortId     = c.id.slice(0, 12) + "…" + c.id.slice(-8);

      const milestonesHtml = c.milestones
        .map((m) => {
          const onTimePill = m.onTime === true
            ? `<span style="font-size:9px;font-family:Arial,Helvetica,sans-serif;font-weight:700;color:#16a34a;letter-spacing:0.06em;">ON TIME</span>`
            : m.onTime === false
            ? `<span style="font-size:9px;font-family:Arial,Helvetica,sans-serif;font-weight:700;color:#dc2626;letter-spacing:0.06em;">AFTER DEADLINE</span>`
            : "";

          const confidencePill = m.aiConfidence !== null
            ? `<span style="font-size:9px;font-family:Arial,Helvetica,sans-serif;color:#8a7d72;margin-left:8px;">AI: ${m.aiConfidence}% confidence</span>`
            : "";

          const completedLine = m.completedAt
            ? `<div style="font-size:10px;font-family:Arial,Helvetica,sans-serif;color:#8a7d72;margin-top:2px;">Completed: ${esc(m.completedAt)} &nbsp;${onTimePill}${confidencePill}</div>`
            : `<div style="font-size:10px;font-family:Arial,Helvetica,sans-serif;color:#8a7d72;margin-top:2px;">Deadline: ${esc(m.deadline)}</div>`;

          const connector = `<div style="position:absolute;left:7px;top:20px;bottom:0;width:1px;background:rgba(212,184,150,0.15);"></div>`;

          return `<div style="position:relative;padding-left:24px;padding-bottom:14px;">
            ${connector}
            <div style="position:absolute;left:0;top:4px;width:15px;height:15px;border-radius:50%;border:1.5px solid rgba(196,112,75,0.35);background:#f8f6f3;display:flex;align-items:center;justify-content:center;">
              ${m.status === "COMPLETED" ? `<div style="width:7px;height:7px;border-radius:50%;background:#16a34a;"></div>` : `<div style="width:7px;height:7px;border-radius:50%;background:rgba(196,112,75,0.4);"></div>`}
            </div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#1a1410;line-height:1.3;">${esc(m.title)}</div>
                ${completedLine}
              </div>
              <div style="text-align:right;flex-shrink:0;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#c4704b;">${usd(m.amountUSD)}</div>
                <div style="margin-top:3px;">${milestoneStatusBadge(m.status)}</div>
              </div>
            </div>
          </div>`;
        })
        .join("");

      return `
      <div style="margin-bottom:24px;border:1px solid #e8e0d6;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
        <!-- Contract header -->
        <div style="background:linear-gradient(135deg,#fdf9f5,#f5ede2);padding:16px 20px;border-bottom:1px solid #e8e0d6;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;color:#c4704b;text-transform:uppercase;margin-bottom:4px;">Contract ${idx + 1}</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1a1410;font-weight:400;">${esc(c.title)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a7d72;margin-top:3px;">Recipient: <strong style="color:#2a2018;">${startupLine}</strong> &nbsp;·&nbsp; Deployed: <strong style="color:#c4704b;">${amountLine}</strong> &nbsp;·&nbsp; Initiated: ${esc(c.createdAt)}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              ${contractStatusBadge(c.status)}
              <div style="font-family:'Courier New',Courier,monospace;font-size:9px;color:#b0a49a;margin-top:5px;">${esc(shortId)}</div>
            </div>
          </div>
        </div>
        <!-- Milestones -->
        <div style="padding:16px 20px 4px;background:#fff;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;color:#8a7d72;text-transform:uppercase;margin-bottom:12px;">Milestones</div>
          ${milestonesHtml}
        </div>
      </div>`;
    })
    .join("");
}

function buildReportHtml(p: BuildParams): string {
  const contractsSection = buildContractsSection(p.contracts);

  const onTimeCount = p.contracts
    .flatMap((c) => c.milestones)
    .filter((m) => m.onTime === true).length;
  const totalCompletedMilestones = p.stats.milestonesCompleted;
  const onTimeRate =
    totalCompletedMilestones > 0
      ? Math.round((onTimeCount / totalCompletedMilestones) * 100)
      : null;

  const refsHtml = p.contracts
    .map(
      (c) =>
        `<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8a7d72;min-width:80px;">${esc(c.title.slice(0, 24))}${c.title.length > 24 ? "…" : ""}</span>
          <span style="font-family:'Courier New',Courier,monospace;font-size:11px;color:#2a2018;word-break:break-all;">${esc(c.id)}</span>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stakeholder Transparency Report — ${esc(p.period)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: #f0ece6;
      color: #1a1410;
      padding: 40px 20px 60px;
      min-height: 100vh;
    }

    .page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      box-shadow: 0 4px 40px rgba(0,0,0,0.12);
      border-radius: 4px;
      overflow: hidden;
    }

    /* ── Letterhead ── */
    .letterhead {
      background: #171311;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .letterhead-inner {
      padding: 28px 40px 24px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      position: relative;
      z-index: 1;
    }
    .letterhead-dots {
      position: absolute;
      inset: 0;
      opacity: 0.04;
      background-image: radial-gradient(circle, #d4b896 1px, transparent 1px);
      background-size: 22px 22px;
    }
    .brand-logo-wrap { display: flex; align-items: center; gap: 14px; }
    .brand-hexagon {
      width: 40px; height: 40px; flex-shrink: 0;
    }
    .brand-text { display: flex; flex-direction: column; gap: 2px; }
    .brand-name {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #d4b896;
    }
    .brand-sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.5px;
      letter-spacing: 0.16em;
      color: #7a6e66;
      text-transform: uppercase;
    }
    .letterhead-right { text-align: right; }
    .doc-type {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #c4704b;
    }
    .confidential-badge {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 10px;
      border: 1px solid rgba(196,112,75,0.35);
      border-radius: 999px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #c4704b;
      background: rgba(196,112,75,0.08);
    }

    /* Copper accent bar */
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg,
        #171311 0%,
        #9a4e2e 15%,
        #c4704b 30%,
        #d4b896 50%,
        #c4704b 70%,
        #9a4e2e 85%,
        #171311 100%
      );
    }

    /* ── Report meta banner ── */
    .meta-banner {
      background: linear-gradient(135deg, #fdfaf7, #f5ede2);
      border-bottom: 1px solid #e8e0d6;
      padding: 22px 40px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
    }
    .report-title {
      font-size: 22px;
      font-weight: 400;
      color: #1a1410;
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }
    .report-subtitle {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #8a7d72;
      line-height: 1.6;
    }
    .report-subtitle strong { color: #2a2018; }
    .meta-stamp {
      text-align: right;
    }
    .meta-stamp-id {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10px;
      color: #b0a49a;
      letter-spacing: 0.05em;
    }
    .meta-stamp-date {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #8a7d72;
      margin-top: 3px;
    }
    .meta-stamp-seal {
      margin-top: 8px;
      display: inline-block;
      padding: 3px 10px;
      border: 1px solid rgba(22,163,74,0.35);
      border-radius: 999px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #16a34a;
      background: rgba(22,163,74,0.07);
    }

    /* ── Body ── */
    .body { padding: 36px 40px; }

    .section { margin-bottom: 36px; }
    .section-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #c4704b;
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e8e0d6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 14px;
      background: #c4704b;
      border-radius: 2px;
      flex-shrink: 0;
    }

    /* Executive summary */
    .narrative {
      font-size: 15px;
      line-height: 1.85;
      color: #1a1410;
      font-style: normal;
    }

    /* Stats grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1px;
      background: #e8e0d6;
      border: 1px solid #e8e0d6;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 0;
    }
    .stat-cell {
      background: #fdfaf7;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .stat-label {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #8a7d72;
    }
    .stat-value {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 22px;
      font-weight: 300;
      color: #1a1410;
      line-height: 1;
    }
    .stat-value.copper { color: #c4704b; }
    .stat-value.green  { color: #16a34a; }
    .stat-sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #a89b8c;
    }

    /* Divider */
    .divider {
      height: 1px;
      background: #e8e0d6;
      margin: 28px 0;
    }

    /* Refs */
    .ref-table { width: 100%; border-collapse: collapse; }
    .ref-table td {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10.5px;
      color: #2a2018;
      padding: 4px 0;
      vertical-align: top;
      word-break: break-all;
    }
    .ref-table .ref-key {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8a7d72;
      white-space: nowrap;
      padding-right: 16px;
      min-width: 80px;
    }

    /* ── Footer ── */
    .footer {
      background: #171311;
      padding: 20px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .footer-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .footer-note {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #5a4f47;
      letter-spacing: 0.07em;
    }
    .footer-note.light { color: #7a6e66; }
    .footer-right {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #5a4f47;
      text-align: right;
    }

    /* Print */
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; max-width: 100%; }
      .print-btn { display: none !important; }
    }

    .print-btn-wrap {
      max-width: 800px;
      margin: 20px auto 0;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .print-btn {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #c4704b;
      background: transparent;
      border: 1px solid rgba(196,112,75,0.5);
      padding: 9px 28px;
      border-radius: 6px;
      cursor: pointer;
      letter-spacing: 0.04em;
      transition: background 0.15s;
    }
    .print-btn:hover { background: rgba(196,112,75,0.08); }
  </style>
</head>
<body>
  <div class="page">

    <!-- ── Letterhead ─────────────────────────────────────────── -->
    <div class="letterhead">
      <div class="letterhead-dots"></div>
      <div class="letterhead-inner">
        <div class="brand-logo-wrap">
          <svg class="brand-hexagon" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="#d4b896" stroke-width="1.4"/>
            <polygon points="20,8 30,14 30,26 20,32 10,26 10,14" fill="#d4b896" fill-opacity="0.06" stroke="#c4704b" stroke-width="0.8"/>
            <circle cx="20" cy="20" r="4.5" fill="#d4b896"/>
          </svg>
          <div class="brand-text">
            <span class="brand-name">CASCROW</span>
            <span class="brand-sub">AI-Powered Grant Escrow Platform</span>
          </div>
        </div>
        <div class="letterhead-right">
          <div class="doc-type">Stakeholder Transparency Report</div>
          <div class="confidential-badge">CONFIDENTIAL</div>
        </div>
      </div>
    </div>
    <div class="accent-bar"></div>

    <!-- ── Report meta banner ──────────────────────────────────── -->
    <div class="meta-banner">
      <div>
        <h1 class="report-title">Quarterly Transparency Report</h1>
        <p class="report-subtitle">
          <strong>Period:</strong> ${esc(p.period)}<br>
          <strong>Prepared for:</strong> ${esc(p.investorName)}<br>
          <strong>Issued by:</strong> cascrow.com &nbsp;·&nbsp; AI-Powered Grant Escrow
        </p>
      </div>
      <div class="meta-stamp">
        <div class="meta-stamp-id">${esc(p.reportId)}</div>
        <div class="meta-stamp-date">Generated ${esc(p.generatedAt)}</div>
        <div class="meta-stamp-seal">✓ AI Verified</div>
      </div>
    </div>

    <!-- ── Body ────────────────────────────────────────────────── -->
    <div class="body">

      <!-- Executive Summary -->
      <div class="section">
        <div class="section-title">Executive Summary</div>
        <p class="narrative">${esc(p.narrative)}</p>
      </div>

      <!-- Portfolio Overview -->
      <div class="section">
        <div class="section-title">Portfolio Overview</div>
        <div class="stats-grid">
          <div class="stat-cell">
            <span class="stat-label">Contracts</span>
            <span class="stat-value">${p.stats.totalContracts}</span>
            <span class="stat-sub">total this period</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Completed</span>
            <span class="stat-value green">${p.stats.milestonesCompleted}</span>
            <span class="stat-sub">milestones verified</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Deployed</span>
            <span class="stat-value copper">${usd(p.stats.totalDeployedUSD)}</span>
            <span class="stat-sub">RLUSD in escrow</span>
          </div>
          <div class="stat-cell">
            <span class="stat-label">Released</span>
            <span class="stat-value">${usd(p.stats.totalReleasedUSD)}</span>
            <span class="stat-sub">RLUSD to recipients</span>
          </div>
        </div>

        ${
          onTimeRate !== null || p.stats.avgConfidence !== null || p.stats.milestonesActive > 0
            ? `<div style="display:flex;gap:1px;background:#e8e0d6;border:1px solid #e8e0d6;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
                ${onTimeRate !== null ? `<div class="stat-cell" style="flex:1"><span class="stat-label">On-Time Delivery</span><span class="stat-value">${onTimeRate}%</span><span class="stat-sub">of completed milestones</span></div>` : ""}
                ${p.stats.avgConfidence !== null ? `<div class="stat-cell" style="flex:1"><span class="stat-label">Avg AI Confidence</span><span class="stat-value">${p.stats.avgConfidence}%</span><span class="stat-sub">across completed proofs</span></div>` : ""}
                ${p.stats.milestonesActive > 0 ? `<div class="stat-cell" style="flex:1"><span class="stat-label">In Progress</span><span class="stat-value">${p.stats.milestonesActive}</span><span class="stat-sub">active milestones</span></div>` : ""}
                ${p.stats.milestonesRejectedOrExpired > 0 ? `<div class="stat-cell" style="flex:1"><span class="stat-label">Rejected / Expired</span><span class="stat-value">${p.stats.milestonesRejectedOrExpired}</span><span class="stat-sub">milestones</span></div>` : ""}
              </div>`
            : ""
        }
      </div>

      <!-- Contract Details -->
      <div class="section">
        <div class="section-title">Contract Details</div>
        ${contractsSection}
      </div>

      <!-- Tamper-Evident References -->
      ${
        p.contracts.length > 0
          ? `<div class="section">
              <div class="section-title">Tamper-Evident Contract References</div>
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a7d72;margin-bottom:12px;line-height:1.6;">
                The following contract identifiers are permanently recorded on the XRPL EVM Sidechain and the native XRP Ledger. They can be independently verified at any time.
              </p>
              <table class="ref-table">
                <tbody>
                  ${refsHtml}
                </tbody>
              </table>
            </div>`
          : ""
      }

      <!-- Methodology Note -->
      <div class="divider"></div>
      <div style="padding:20px 24px;background:#fdfaf7;border:1px solid #e8e0d6;border-radius:8px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:9px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8a7d72;margin-bottom:8px;">About This Report</div>
        <p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a7d72;line-height:1.7;">
          This report was generated automatically by cascrow's AI transparency reporting engine. All verification decisions referenced herein were rendered by a 5-model AI consensus engine (Claude Haiku, Gemini Flash, GPT-4o-mini, Mistral Small, Cerebras/Qwen3) requiring a 3-of-5 majority vote. Fund releases and cancellations are executed on-chain by the cascrow platform signer and are irreversible. This document is intended solely for the authorized recipient and their designated stakeholders.
        </p>
      </div>

    </div>

    <!-- ── Footer ──────────────────────────────────────────────── -->
    <div class="footer">
      <div class="footer-left">
        <span class="footer-note light">Generated by cascrow.com · AI-Powered Grant Escrow Platform</span>
        <span class="footer-note">Non-transferable · For authorized recipients only · ${esc(p.reportId)}</span>
      </div>
      <div class="footer-right">
        <div class="footer-note light">XRPL EVM Sidechain · XRP Ledger Mainnet</div>
        <div class="footer-note" style="margin-top:2px;">${esc(p.generatedAt)}</div>
      </div>
    </div>

  </div>

  <div class="print-btn-wrap">
    <button class="print-btn" onclick="window.print()">
      ↓ Download / Print as PDF
    </button>
  </div>
</body>
</html>`;
}
