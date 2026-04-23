/**
 * POST /api/reports/board-pack
 * Feature III: Board Report Pack
 *
 * Generates a board-ready HTML report from all verified AttestationEntry records
 * for a given contract and period. Includes:
 * - AI-generated executive summary
 * - Per-milestone attestation table with verdicts + XRPL links
 * - Regulatory framework groupings (CSRD, GRI, SDG, TCFD, ISO)
 * - Appendix with cert links
 *
 * Stores the generated report as a Vercel Blob and creates a Report record.
 * Returns the blob URL.
 *
 * Rate limited: 5/hour per user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://cascrow.com";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const bodySchema = z.object({
  contractId: z.string().min(1).max(50),
  period: z.string().min(1).max(20),
  frameworks: z.array(z.enum(["CSRD", "GRI", "SDG", "TCFD", "ISO"])).optional(),
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return url;
  } catch { return null; }
}

function verdictBadge(verdict: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    YES:          { label: "VERIFIED",     color: "#065F46", bg: "#D1FAE5" },
    NO:           { label: "NOT MET",      color: "#991B1B", bg: "#FEE2E2" },
    INCONCLUSIVE: { label: "INCONCLUSIVE", color: "#92400E", bg: "#FEF3C7" },
  };
  const cfg = map[verdict] ?? { label: esc(verdict), color: "#374151", bg: "#F3F4F6" };
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;letter-spacing:.05em;color:${cfg.color};background:${cfg.bg}">${cfg.label}</span>`;
}

function frameworkBadge(tag: string) {
  const prefix = tag.split(":")[0] ?? "";
  const colors: Record<string, string> = {
    CSRD: "#14532D:#DCFCE7",
    SDG:  "#1E3A5F:#DBEAFE",
    GRI:  "#3B0764:#EDE9FE",
    TCFD: "#78350F:#FEF3C7",
    ISO:  "#1E293B:#F1F5F9",
  };
  const [color, bg] = (colors[prefix] ?? "#374151:#F3F4F6").split(":");
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.04em;color:${color};background:${bg};margin:2px">${esc(tag)}</span>`;
}

interface RegMapItem { framework: string; article: string; clause?: string; confidence: number }

async function generateExecutiveSummary(
  contractTitle: string,
  period: string,
  milestones: {
    title: string;
    status: string;
    entries: { aiVerdict: string; aiReasoning: string; period: string }[];
  }[]
): Promise<string> {
  const anthropic = getAnthropic();

  const milestoneSummary = milestones
    .map((m) => {
      const latest = m.entries[0];
      return `- ${m.title}: ${latest ? `${latest.aiVerdict} (${latest.period}) — ${latest.aiReasoning.slice(0, 120)}` : "No attestation runs"}`;
    })
    .join("\n");

  const verified = milestones.filter((m) => m.entries.some((e) => e.aiVerdict === "YES")).length;
  const total = milestones.length;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: `You are a corporate reporting assistant. Write a professional 2-3 paragraph executive summary for a board report on KPI attestations. Be factual, concise, and formal. Do NOT use markdown — use plain text only.`,
      messages: [{
        role: "user",
        content: `Company goal set: "${contractTitle}"
Period: ${period}
Results: ${verified}/${total} milestones verified.

Milestone details:
${milestoneSummary}

Write the executive summary for this board report.`,
      }],
    });

    void prisma.apiUsage.create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd:
          (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "board-report-summary",
      },
    }).catch(() => {});

    return response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
  } catch {
    return `This report covers ${total} KPI milestone${total !== 1 ? "s" : ""} for ${contractTitle} in period ${period}. ${verified} of ${total} milestone${total !== 1 ? "s" : ""} were verified by cascrow AI.`;
  }
}

function buildHtml({
  contractTitle,
  period,
  generatedAt,
  executiveSummary,
  milestones,
  frameworks,
}: {
  contractTitle: string;
  period: string;
  generatedAt: string;
  executiveSummary: string;
  milestones: {
    id: string;
    title: string;
    description: string | null;
    regulatoryTags: string[];
    entries: {
      id: string;
      period: string;
      aiVerdict: string;
      aiReasoning: string;
      xrplTxHash: string | null;
      certUrl: string | null;
      fetchedHash: string;
      fetchedAt: Date;
      type: string;
      regulatoryMapping: RegMapItem[];
    }[];
  }[];
  frameworks: string[];
}) {
  const verified = milestones.filter((m) => m.entries.some((e) => e.aiVerdict === "YES")).length;
  const total = milestones.length;
  const passRate = total > 0 ? Math.round((verified / total) * 100) : 0;
  const totalRuns = milestones.reduce((s, m) => s + m.entries.length, 0);

  // Group milestones by regulatory framework for the framework section
  const frameworkGroups: Record<string, typeof milestones> = {};
  for (const fw of frameworks) {
    frameworkGroups[fw] = milestones.filter((m) =>
      m.regulatoryTags.some((t) => t.startsWith(fw + ":")) ||
      m.entries.some((e) => e.regulatoryMapping.some((r) => r.framework === fw))
    );
  }

  const milestoneSections = milestones.map((m, idx) => {
    const latest = m.entries[0];
    const entriesRows = m.entries.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:#9CA3AF;padding:16px;font-size:12px">No attestation runs in this period</td></tr>`
      : m.entries.map((e) => {
          const xrplHref = e.xrplTxHash ? safeHref(`${XRPL_EXPLORER}/transactions/${e.xrplTxHash}`) : null;
          const certHref = e.certUrl ? safeHref(e.certUrl) : null;
          return `
          <tr style="border-top:1px solid #F3F4F6">
            <td style="padding:8px 12px;font-size:12px;color:#374151">${esc(e.period)}</td>
            <td style="padding:8px 12px">${verdictBadge(e.aiVerdict)}</td>
            <td style="padding:8px 12px;font-size:11px;color:#4B5563;max-width:220px">${esc(e.aiReasoning.slice(0, 150))}${e.aiReasoning.length > 150 ? "…" : ""}</td>
            <td style="padding:8px 12px;font-size:11px;color:#6B7280;font-family:monospace">${e.fetchedHash ? esc(e.fetchedHash.slice(0, 12) + "…") : "—"}</td>
            <td style="padding:8px 12px;font-size:11px">
              ${xrplHref
                ? `<a href="${esc(xrplHref)}" style="color:#C4704B;text-decoration:none;font-family:monospace" target="_blank">${esc(e.xrplTxHash!.slice(0, 10))}…</a>`
                : `<span style="color:#D1D5DB">—</span>`}
              ${certHref ? ` <a href="${esc(certHref)}" style="color:#7C3AED;font-size:10px;display:block" target="_blank">cert ↗</a>` : ""}
            </td>
          </tr>`;
        }).join("");

    const allTags = [
      ...m.regulatoryTags,
      ...Array.from(new Set(m.entries.flatMap((e) => e.regulatoryMapping.map((r) => `${r.framework}:${r.article}`)))),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const tagsHtml = allTags.length > 0
      ? `<div style="margin-top:8px">${allTags.map(frameworkBadge).join("")}</div>`
      : "";

    const latestVerdictHtml = latest
      ? `<div style="float:right">${verdictBadge(latest.aiVerdict)}</div>`
      : `<div style="float:right"><span style="color:#9CA3AF;font-size:12px">No runs</span></div>`;

    return `
    <div style="margin-bottom:32px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
      <div style="background:#F9FAFB;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:11px;color:#9CA3AF;font-weight:600">MILESTONE ${idx + 1}</span>
          <h3 style="margin:4px 0 0;font-size:15px;font-weight:700;color:#111827">${esc(m.title)}</h3>
          ${m.description ? `<p style="margin:4px 0 0;font-size:12px;color:#6B7280">${esc(m.description.slice(0, 160))}${m.description.length > 160 ? "…" : ""}</p>` : ""}
          ${tagsHtml}
        </div>
        ${latestVerdictHtml}
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#F3F4F6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600">Period</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600">Verdict</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600">AI Reasoning</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600">Evidence Hash</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:600">On-Chain</th>
          </tr>
        </thead>
        <tbody>${entriesRows}</tbody>
      </table>
    </div>`;
  }).join("");

  const frameworkSections = frameworks.map((fw) => {
    const fwMilestones = frameworkGroups[fw] ?? [];
    if (fwMilestones.length === 0) return "";
    const fwColors: Record<string, string> = {
      CSRD: "#14532D", GRI: "#3B0764", SDG: "#1E3A5F", TCFD: "#78350F", ISO: "#1E293B",
    };
    const fwBg: Record<string, string> = {
      CSRD: "#DCFCE7", GRI: "#EDE9FE", SDG: "#DBEAFE", TCFD: "#FEF3C7", ISO: "#F1F5F9",
    };
    return `
    <div style="margin-bottom:24px">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:${fwColors[fw] ?? "#374151"};padding:6px 12px;background:${fwBg[fw] ?? "#F3F4F6"};border-radius:6px;display:inline-block">${esc(fw)}</h3>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151">
        ${fwMilestones.map((m) => {
          const latest = m.entries[0];
          return `<li style="margin-bottom:6px"><strong>${esc(m.title)}</strong>${latest ? ` — ${verdictBadge(latest.aiVerdict)}` : ""}</li>`;
        }).join("")}
      </ul>
    </div>`;
  }).filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Board Report Pack — ${esc(contractTitle)} — ${esc(period)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 0; background: #fff; color: #111827; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body style="max-width:900px;margin:0 auto;padding:40px 32px">

  <!-- Header -->
  <div style="border-bottom:3px solid #C4704B;padding-bottom:24px;margin-bottom:32px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C4704B;font-weight:600">Board Report Pack</p>
        <h1 style="margin:8px 0 4px;font-size:28px;font-weight:700;color:#111827">${esc(contractTitle)}</h1>
        <p style="margin:0;font-size:14px;color:#6B7280">Period: <strong>${esc(period)}</strong></p>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:12px;color:#9CA3AF">Generated ${esc(generatedAt)}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#9CA3AF">cascrow.com</p>
      </div>
    </div>
  </div>

  <!-- Summary stats -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px">
    ${[
      { label: "Total Milestones", value: String(total) },
      { label: "Verified", value: String(verified) },
      { label: "Pass Rate", value: `${passRate}%` },
      { label: "Attestation Runs", value: String(totalRuns) },
    ].map((s) => `
    <div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;text-align:center">
      <p style="margin:0;font-size:22px;font-weight:700;color:#111827">${esc(s.value)}</p>
      <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.05em">${esc(s.label)}</p>
    </div>`).join("")}
  </div>

  <!-- Executive Summary -->
  <div style="margin-bottom:40px;padding:24px;background:#FFFBF5;border-left:4px solid #C4704B;border-radius:0 8px 8px 0">
    <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.05em">Executive Summary</h2>
    <div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-line">${esc(executiveSummary)}</div>
  </div>

  <!-- Milestones -->
  <div style="margin-bottom:40px">
    <h2 style="font-size:16px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.05em;margin-bottom:20px;border-bottom:1px solid #E5E7EB;padding-bottom:8px">Attestation Results</h2>
    ${milestoneSections}
  </div>

  ${frameworkSections ? `
  <!-- Regulatory Frameworks -->
  <div style="margin-bottom:40px">
    <h2 style="font-size:16px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.05em;margin-bottom:20px;border-bottom:1px solid #E5E7EB;padding-bottom:8px">Regulatory Frameworks Addressed</h2>
    ${frameworkSections}
  </div>` : ""}

  <!-- Appendix -->
  <div style="margin-bottom:40px">
    <h2 style="font-size:16px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px;border-bottom:1px solid #E5E7EB;padding-bottom:8px">Appendix — Certificate Links</h2>
    ${milestones.flatMap((m) =>
      m.entries.filter((e) => e.certUrl).map((e) => {
        const href = e.certUrl ? safeHref(e.certUrl) : null;
        return href
          ? `<p style="margin:4px 0;font-size:12px"><strong>${esc(m.title)}</strong> (${esc(e.period)}): <a href="${esc(href)}" style="color:#C4704B" target="_blank">${esc(href)}</a></p>`
          : "";
      })
    ).filter(Boolean).join("") || `<p style="color:#9CA3AF;font-size:13px">No certificates generated yet.</p>`}
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #E5E7EB;padding-top:20px;margin-top:40px;text-align:center">
    <p style="margin:0;font-size:11px;color:#9CA3AF">All data verified by cascrow AI and recorded on XRP Ledger. Report generated ${esc(generatedAt)}. <a href="https://cascrow.com" style="color:#C4704B">cascrow.com</a></p>
  </div>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`board-pack:${session.user.id}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many report requests. Please wait before trying again." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { contractId, period, frameworks = [] } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, mode: true, milestone: true, auditorEmail: true },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Board packs are only available for attestation contracts" }, { status: 400 });
  }

  const isOwner = contract.investorId === session.user.id;
  const isAuditor = contract.auditorEmail?.toLowerCase() === session.user.email?.toLowerCase();
  if (!isOwner && !isAuditor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const milestones = await prisma.milestone.findMany({
    where: { contractId },
    orderBy: { order: "asc" },
    include: {
      attestationEntries: {
        where: {
          OR: [
            { period: { contains: period } },
            // Also include entries from sub-periods (e.g. period "2026" catches "2026-Q1", "2026-04")
            { period: { startsWith: period } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          period: true,
          aiVerdict: true,
          aiReasoning: true,
          xrplTxHash: true,
          certUrl: true,
          fetchedHash: true,
          fetchedAt: true,
          type: true,
          regulatoryMapping: true,
        },
      },
    },
  });

  const formattedMilestones = milestones.map((m) => {
    let tags: string[] = [];
    try { tags = JSON.parse(m.regulatoryTags ?? "[]") as string[]; } catch { /**/ }

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      regulatoryTags: tags,
      entries: m.attestationEntries.map((e) => {
        let regMap: RegMapItem[] = [];
        try {
          if (Array.isArray(e.regulatoryMapping)) regMap = e.regulatoryMapping as unknown as RegMapItem[];
        } catch { /**/ }
        return { ...e, regulatoryMapping: regMap };
      }),
    };
  });

  const executiveSummary = await generateExecutiveSummary(
    contract.milestone,
    period,
    formattedMilestones.map((m) => ({
      title: m.title,
      status: "ATTESTATION",
      entries: m.entries.map((e) => ({
        aiVerdict: e.aiVerdict,
        aiReasoning: e.aiReasoning,
        period: e.period,
      })),
    }))
  );

  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const html = buildHtml({
    contractTitle: contract.milestone,
    period,
    generatedAt,
    executiveSummary,
    milestones: formattedMilestones,
    frameworks,
  });

  // Store to Vercel Blob
  const slug = `${contractId}-${period.replace(/[^a-z0-9-]/gi, "-")}-${Date.now()}`;
  let blobUrl: string;
  try {
    const blob = await put(`reports/board-pack/${slug}.html`, html, {
      access: "public",
      contentType: "text/html; charset=utf-8",
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("[board-pack] blob upload failed:", err);
    return NextResponse.json({ error: "Failed to store report" }, { status: 500 });
  }

  // Save Report record
  const report = await prisma.report.create({
    data: { contractId, period, type: "BOARD_PACK", blobUrl },
  });

  return NextResponse.json({ reportId: report.id, blobUrl, period });
}
