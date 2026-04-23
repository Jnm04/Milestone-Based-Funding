import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const IS_TESTNET = process.env.XRPL_NETWORK === "testnet";
const XRPL_EXPLORER = IS_TESTNET ? "https://testnet.xrpscan.com" : "https://xrpscan.com";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

function tagBadge(tag: string) {
  const prefix = tag.split(":")[0];
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

function statusLabel(status: string) {
  const map: Record<string, string> = {
    VERIFIED: "Verified", COMPLETED: "Completed", REJECTED: "Rejected",
    PROOF_SUBMITTED: "Under Review", FUNDED: "Ready", PENDING: "Pending",
    PENDING_REVIEW: "Inconclusive",
  };
  return map[status] ?? status;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: {
      investorId: true, auditorEmail: true, mode: true,
      milestone: true, createdAt: true,
    },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION")
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  const isOwner = contract.investorId === session.user.id;
  const isAuditor = contract.auditorEmail?.toLowerCase() === session.user.email?.toLowerCase();
  if (!isOwner && !isAuditor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const milestones = await prisma.milestone.findMany({
    where: { contractId: id },
    orderBy: { order: "asc" },
    include: {
      attestationEntries: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          period: true,
          aiVerdict: true,
          aiReasoning: true,
          certUrl: true,
          xrplTxHash: true,
          fetchedHash: true,
          fetchedAt: true,
          type: true,
          auditorEmail: true,
          createdAt: true,
        },
      },
    },
  });

  const totalMilestones = milestones.length;
  const verifiedCount = milestones.filter((m) =>
    ["VERIFIED", "COMPLETED"].includes(m.status)
  ).length;
  const totalRuns = milestones.reduce((s, m) => s + m.attestationEntries.length, 0);
  const yesRuns = milestones.reduce(
    (s, m) => s + m.attestationEntries.filter((e) => e.aiVerdict === "YES").length,
    0
  );
  const passRate = totalRuns > 0 ? Math.round((yesRuns / totalRuns) * 100) : 0;
  const generatedAt = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const createdAt = contract.createdAt.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const milestoneSections = milestones.map((m, idx) => {
    let tags: string[] = [];
    try { tags = JSON.parse(m.regulatoryTags ?? "[]") as string[]; } catch { /**/ }

    const entriesRows = m.attestationEntries.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:16px;font-size:12px">No attestation runs yet</td></tr>`
      : m.attestationEntries.map((e) => `
        <tr style="border-top:1px solid #F3F4F6">
          <td style="padding:8px 12px;font-size:12px;color:#374151">${esc(e.period)}</td>
          <td style="padding:8px 12px">${verdictBadge(e.aiVerdict)}</td>
          <td style="padding:8px 12px;font-size:11px;color:#4B5563;max-width:260px">${esc(e.aiReasoning ?? "—")}</td>
          <td style="padding:8px 12px;font-size:11px;color:#6B7280;font-family:monospace">${e.fetchedHash ? esc(e.fetchedHash.slice(0, 12) + "…") : "—"}</td>
          <td style="padding:8px 12px;font-size:11px">
            ${e.xrplTxHash
              ? `<a href="${esc(XRPL_EXPLORER)}/transactions/${esc(e.xrplTxHash)}" style="color:#C4704B;text-decoration:none;font-family:monospace">${esc(e.xrplTxHash.slice(0, 10))}…</a>`
              : `<span style="color:#D1D5DB">—</span>`}
          </td>
          <td style="padding:8px 12px;font-size:11px;color:#9CA3AF">${e.type === "AUDITOR_RERUN" ? `<span style="color:#7C3AED;font-weight:600">AUDITOR</span>` : "Platform"}</td>
        </tr>`).join("");

    const tagsHtml = tags.length > 0
      ? `<div style="margin-top:10px">${tags.map(tagBadge).join("")}</div>`
      : "";

    const srcLabel: Record<string, string> = {
      URL_SCRAPE: "URL Scraping", REST_API: "REST API",
      FILE_UPLOAD: "File Upload", MANUAL_REVIEW: "Manual Review",
    };

    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px">
          <span style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:#C4704B;color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1">${idx + 1}</span>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <h3 style="margin:0;font-size:15px;font-weight:600;color:#111827">${esc(m.title)}</h3>
              <span style="font-size:11px;font-weight:600;color:#6B7280;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:4px;padding:1px 8px">${statusLabel(m.status)}</span>
            </div>
            ${m.description ? `<p style="margin:4px 0 0;font-size:12px;color:#6B7280">${esc(m.description)}</p>` : ""}
            <p style="margin:4px 0 0;font-size:11px;color:#9CA3AF">
              Source: ${esc(srcLabel[m.dataSourceType ?? ""] ?? "—")}
              ${m.dataSourceUrl ? ` · <a href="${esc(m.dataSourceUrl)}" style="color:#C4704B;text-decoration:none">${esc(m.dataSourceUrl)}</a>` : ""}
              · Deadline: ${new Date(m.cancelAfter).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            ${tagsHtml}
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;background:#FAFAFA;border-radius:6px;overflow:hidden;font-family:inherit">
          <thead>
            <tr style="background:#F3F4F6">
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280;white-space:nowrap">Period</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280">Verdict</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280">AI Assessment</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280">Evidence Hash</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280">On-Chain</th>
              <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6B7280">Run Type</th>
            </tr>
          </thead>
          <tbody>${entriesRows}</tbody>
        </table>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Board Report — ${esc(contract.milestone)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0; padding: 0;
      background: #F9FAFB; color: #111827;
    }
    .page { max-width: 900px; margin: 0 auto; padding: 40px 48px; background: white; }
    @media print {
      body { background: white; }
      .page { padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
      a { color: inherit; }
      @page { margin: 18mm 16mm; }
    }
    @media (max-width: 640px) {
      .page { padding: 24px 20px; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Print button -->
  <div class="no-print" style="position:fixed;top:20px;right:24px;z-index:10;display:flex;gap:8px">
    <button onclick="window.print()" style="padding:8px 18px;background:#C4704B;color:white;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.15)">
      Print / Save PDF
    </button>
    <button onclick="window.close()" style="padding:8px 14px;background:white;color:#374151;border:1px solid #D1D5DB;border-radius:7px;font-size:13px;cursor:pointer">
      Close
    </button>
  </div>

  <!-- Header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #C4704B">
    <div>
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#C4704B">cascrow · Corporate KPI Attestation</p>
      <h1 style="margin:0 0 4px;font-size:24px;font-weight:700;color:#111827;letter-spacing:-.02em">${esc(contract.milestone)}</h1>
      <p style="margin:0;font-size:13px;color:#6B7280">Board Report Pack · ${esc(generatedAt)}</p>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <p style="margin:0 0 2px;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.06em">Report ID</p>
      <p style="margin:0;font-size:12px;font-family:monospace;color:#374151">${esc(id.slice(0, 16))}</p>
    </div>
  </div>

  <!-- Executive Summary -->
  <div style="margin-bottom:32px">
    <h2 style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280">Executive Summary</h2>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Milestones</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#111827">${totalMilestones}</p>
      </div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Verified</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#059669">${verifiedCount}</p>
      </div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Total Runs</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#111827">${totalRuns}</p>
      </div>
      <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Pass Rate</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:${passRate >= 70 ? "#059669" : passRate >= 40 ? "#D97706" : "#DC2626"}">${passRate}%</p>
      </div>
    </div>
  </div>

  <!-- Metadata -->
  <div style="margin-bottom:32px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;display:flex;gap:32px;flex-wrap:wrap">
    <div>
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Goal Set Created</p>
      <p style="margin:0;font-size:13px;color:#374151">${esc(createdAt)}</p>
    </div>
    ${contract.auditorEmail ? `<div>
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Assigned Auditor</p>
      <p style="margin:0;font-size:13px;color:#374151">${esc(contract.auditorEmail)}</p>
    </div>` : ""}
    <div>
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Verification Method</p>
      <p style="margin:0;font-size:13px;color:#374151">5-model AI majority vote (3/5 required)</p>
    </div>
    <div>
      <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Blockchain Record</p>
      <p style="margin:0;font-size:13px;color:#374151">XRP Ledger Mainnet</p>
    </div>
  </div>

  <!-- Milestones -->
  <div style="margin-bottom:40px">
    <h2 style="margin:0 0 20px;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280">Milestone Attestations</h2>
    ${milestoneSections}
  </div>

  <!-- Disclaimer -->
  <div style="border-top:1px solid #E5E7EB;padding-top:20px;margin-top:8px">
    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF">Attestation Methodology</p>
    <p style="margin:0;font-size:11px;color:#6B7280;line-height:1.6">
      Each attestation run fetches live data from the configured source and submits it to five independent AI models
      (Anthropic Claude, Google Gemini, OpenAI GPT, Mistral, Cerebras). A majority vote of ≥ 3 / 5 YES verdicts is required
      for a VERIFIED result. Every run is anchored to the XRP Ledger mainnet via an AccountSet transaction memo,
      providing an immutable, timestamped audit trail independent of cascrow infrastructure.
    </p>
    <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <p style="margin:0;font-size:11px;color:#9CA3AF">Generated by <strong style="color:#C4704B">cascrow</strong> · cascrow.com · ${esc(generatedAt)}</p>
      <p style="margin:0;font-size:11px;font-family:monospace;color:#D1D5DB">${esc(id)}</p>
    </div>
  </div>

</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}
