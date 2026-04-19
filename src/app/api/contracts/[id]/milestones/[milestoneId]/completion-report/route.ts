import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import type { ModelVote } from "@/components/ai-result";

/**
 * GET /api/contracts/[id]/milestones/[milestoneId]/completion-report
 *
 * Returns a print-ready HTML completion report for a verified milestone.
 * Accessible by the investor or startup on this contract.
 * The AI narrative (Feature L) is shown if already generated; falls back to
 * the AI verification reasoning if not yet available.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      investorId: true,
      startupId: true,
      milestone: true,
      milestones: {
        where: { id: milestoneId },
        select: {
          id: true,
          title: true,
          amountUSD: true,
          cancelAfter: true,
          status: true,
          nftTokenId: true,
          completionNarrative: true,
          completionNarrativeAt: true,
          updatedAt: true,
          proofs: {
            where: { aiDecision: "YES" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              aiDecision: true,
              aiReasoning: true,
              aiConfidence: true,
              aiModelVotes: true,
            },
          },
        },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const isParty =
    contract.investorId === session.user.id ||
    contract.startupId === session.user.id;
  if (!isParty) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const milestone = contract.milestones[0];
  if (!milestone) {
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  }

  if (milestone.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Report only available for completed milestones" },
      { status: 409 }
    );
  }

  const approvedProof = milestone.proofs[0] ?? null;
  const modelVotes = approvedProof?.aiModelVotes as ModelVote[] | null;
  const completedAt = milestone.updatedAt;
  const completedOnTime = completedAt <= milestone.cancelAfter;
  const narrative =
    milestone.completionNarrative ??
    approvedProof?.aiReasoning ??
    "This milestone was successfully completed and verified by cascrow's AI consensus engine.";

  const html = buildReportHtml({
    contractId,
    milestoneId,
    milestoneTitle: milestone.title,
    amountUSD: milestone.amountUSD.toString(),
    completedAt,
    completedOnTime,
    cancelAfter: milestone.cancelAfter,
    narrative,
    aiConfidence: approvedProof?.aiConfidence ?? null,
    modelVotes: modelVotes ?? [],
    nftTokenId: milestone.nftTokenId ?? null,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ReportParams {
  contractId: string;
  milestoneId: string;
  milestoneTitle: string;
  amountUSD: string;
  completedAt: Date;
  completedOnTime: boolean;
  cancelAfter: Date;
  narrative: string;
  aiConfidence: number | null;
  modelVotes: ModelVote[];
  nftTokenId: string | null;
}

function buildReportHtml(p: ReportParams): string {
  const completedDate = p.completedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const deadlineDate = p.cancelAfter.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const amount = `$${Number(p.amountUSD).toLocaleString("en-US")}`;
  const shortContractId = p.contractId.slice(0, 10) + "…" + p.contractId.slice(-8);

  const yesVotes = p.modelVotes.filter((v) => v.decision === "YES").length;
  const totalVotes = p.modelVotes.length;

  const votesHtml =
    p.modelVotes.length > 0
      ? p.modelVotes
          .map((v) => {
            const isYes = v.decision === "YES";
            return `<div class="vote-cell ${isYes ? "yes" : "no"}">
              <span class="vote-label">${isYes ? "YES" : "NO"}</span>
              <span class="vote-model">${esc(v.model.split(/[\s/]/)[0])}</span>
            </div>`;
          })
          .join("")
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Completion Report — ${esc(p.milestoneTitle)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      background: #f8f6f3;
      color: #1a1410;
      min-height: 100vh;
      padding: 48px 24px;
    }

    .page {
      max-width: 720px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d4b896;
      border-radius: 8px;
      overflow: hidden;
    }

    /* Header */
    .header {
      background: #171311;
      padding: 28px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-brand {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .brand-name {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.22em;
      color: #d4b896;
    }
    .brand-sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      letter-spacing: 0.16em;
      color: #7a6e66;
      text-transform: uppercase;
    }
    .verified-badge {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #c4704b;
      border: 1px solid rgba(196,112,75,0.4);
      background: rgba(196,112,75,0.12);
      padding: 6px 16px;
      border-radius: 999px;
    }

    /* Accent line */
    .accent-line {
      height: 3px;
      background: linear-gradient(90deg, #171311, #c4704b 30%, #d4b896 50%, #c4704b 70%, #171311);
    }

    /* Body */
    .body { padding: 40px; }

    .report-title {
      font-size: 11px;
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #c4704b;
      margin-bottom: 10px;
    }

    .milestone-title {
      font-size: 26px;
      font-weight: 400;
      color: #1a1410;
      line-height: 1.3;
      margin-bottom: 24px;
    }

    /* Meta grid */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
      padding: 20px;
      background: #faf8f5;
      border: 1px solid #ede6dd;
      border-radius: 6px;
    }
    .meta-item { display: flex; flex-direction: column; gap: 4px; }
    .meta-label {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #8a7d72;
    }
    .meta-value {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #1a1410;
    }
    .meta-value.amount { color: #c4704b; }
    .meta-value.on-time { color: #16a34a; }
    .meta-value.late { color: #dc2626; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #8a7d72;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #ede6dd;
    }

    /* Narrative */
    .narrative {
      font-size: 15px;
      line-height: 1.75;
      color: #2a2018;
    }

    /* AI verification */
    .verification-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .consensus-badge {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #16a34a;
      background: rgba(22,163,74,0.08);
      border: 1px solid rgba(22,163,74,0.25);
      padding: 4px 14px;
      border-radius: 999px;
    }
    .confidence-text {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #8a7d72;
    }

    .votes-grid {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .vote-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 10px;
      border-radius: 6px;
      min-width: 52px;
    }
    .vote-cell.yes {
      background: rgba(22,163,74,0.08);
      border: 1px solid rgba(22,163,74,0.2);
    }
    .vote-cell.no {
      background: rgba(220,38,38,0.07);
      border: 1px solid rgba(220,38,38,0.2);
    }
    .vote-label {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 700;
    }
    .vote-cell.yes .vote-label { color: #16a34a; }
    .vote-cell.no .vote-label { color: #dc2626; }
    .vote-model {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #8a7d72;
      text-align: center;
    }

    /* Reference */
    .ref-row {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .ref-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
    }
    .ref-key {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8a7d72;
      min-width: 96px;
    }
    .ref-val { color: #2a2018; word-break: break-all; }

    /* Footer */
    .footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #ede6dd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-note {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      color: #a89b8c;
      letter-spacing: 0.07em;
    }

    /* Print */
    @media print {
      body { background: #fff; padding: 0; }
      .page { border: none; border-radius: 0; max-width: 100%; }
      .print-btn { display: none; }
    }

    /* Print button */
    .print-btn {
      display: block;
      margin: 20px auto 0;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #c4704b;
      background: transparent;
      border: 1px solid rgba(196,112,75,0.5);
      padding: 8px 24px;
      border-radius: 6px;
      cursor: pointer;
      letter-spacing: 0.04em;
    }
    .print-btn:hover { background: rgba(196,112,75,0.08); }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-brand">
        <span class="brand-name">CASCROW</span>
        <span class="brand-sub">Milestone Completion Report</span>
      </div>
      <span class="verified-badge">✓ AI Verified</span>
    </div>
    <div class="accent-line"></div>

    <div class="body">
      <p class="report-title">Verified Completion Certificate</p>
      <h1 class="milestone-title">${esc(p.milestoneTitle)}</h1>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Grant Amount</span>
          <span class="meta-value amount">${esc(amount)} RLUSD</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Completed</span>
          <span class="meta-value">${esc(completedDate)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Delivery</span>
          <span class="meta-value ${p.completedOnTime ? "on-time" : "late"}">${p.completedOnTime ? "On Time" : "After Deadline"}</span>
        </div>
      </div>

      <div class="section">
        <p class="section-title">Achievement Summary</p>
        <p class="narrative">${esc(p.narrative)}</p>
      </div>

      <div class="section">
        <p class="section-title">AI Verification Result</p>
        <div class="verification-row">
          <span class="consensus-badge">${totalVotes > 0 ? `${yesVotes}/${totalVotes} Models Approved` : "AI Approved"}</span>
          ${p.aiConfidence !== null ? `<span class="confidence-text">Confidence: ${p.aiConfidence}%</span>` : ""}
        </div>
        ${
          votesHtml
            ? `<div class="votes-grid">${votesHtml}</div>`
            : ""
        }
      </div>

      <div class="section">
        <p class="section-title">Tamper-Evident Reference</p>
        <div class="ref-row">
          <div class="ref-item">
            <span class="ref-key">Contract ID</span>
            <span class="ref-val">${esc(p.contractId)}</span>
          </div>
          ${
            p.nftTokenId
              ? `<div class="ref-item">
                   <span class="ref-key">NFT Token ID</span>
                   <span class="ref-val">${esc(p.nftTokenId)}</span>
                 </div>`
              : ""
          }
          <div class="ref-item">
            <span class="ref-key">Deadline</span>
            <span class="ref-val">${esc(deadlineDate)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <span class="footer-note">Non-transferable · Verified on XRP Ledger · cascrow.com</span>
        <span class="footer-note">${esc(shortContractId)}</span>
      </div>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;
}
