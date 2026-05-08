import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", AWAITING_ESCROW: "Awaiting Escrow", FUNDED: "Funded",
  PROOF_SUBMITTED: "Proof Submitted", PENDING_REVIEW: "Pending Review",
  VERIFIED: "Verified", REJECTED: "Rejected", COMPLETED: "Completed",
  DECLINED: "Declined", EXPIRED: "Expired",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      investor: { select: { name: true, email: true, companyName: true, walletAddress: true } },
      startup:  { select: { name: true, email: true, companyName: true, walletAddress: true } },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true, title: true, amountUSD: true, cancelAfter: true,
          status: true, order: true,
          proofs: {
            where: { aiDecision: "YES" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { aiDecision: true, aiConfidence: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session.user.id;
  if (contract.investorId !== userId && contract.startupId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const usd = (n: number | string | { toString(): string }) => `$${Number(n.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const investorName = contract.investor.companyName ?? contract.investor.name ?? contract.investor.email;
  const startupName  = contract.startup ? (contract.startup.companyName ?? contract.startup.name ?? contract.startup.email) : "—";
  const totalAmount  = contract.milestones.reduce((s, m) => s + Number(m.amountUSD.toString()), 0);
  const completedMs  = contract.milestones.filter((m) => m.status === "COMPLETED").length;

  const milestoneRows = contract.milestones.map((m, i) => {
    const proof = m.proofs[0];
    const statusColor = m.status === "COMPLETED" ? "#34d399" : m.status === "REJECTED" ? "#f87171" : "#C4704B";
    return `
      <tr style="border-bottom:1px solid #2a2019">
        <td style="padding:10px 14px;font-size:13px;color:#A89B8C">${i + 1}</td>
        <td style="padding:10px 14px;font-size:13px;color:#EDE6DD">${m.title}</td>
        <td style="padding:10px 14px;font-size:13px;color:#EDE6DD;font-weight:600">${usd(m.amountUSD)} RLUSD</td>
        <td style="padding:10px 14px;font-size:13px;color:#A89B8C">${fmt(m.cancelAfter)}</td>
        <td style="padding:10px 14px">
          <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;background:${statusColor}22;color:${statusColor}">
            ${STATUS_LABELS[m.status] ?? m.status}
          </span>
        </td>
        <td style="padding:10px 14px;font-size:12px;color:#A89B8C">
          ${proof ? `AI verified · ${proof.aiConfidence ?? "—"}% · ${fmt(proof.createdAt)}` : "—"}
        </td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Contract Report · ${contract.id}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #171311; color: #EDE6DD; padding: 40px; }
    .page { max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 1px solid #2a2019; }
    .logo { font-size: 22px; font-weight: 700; color: #C4704B; letter-spacing: -0.5px; }
    .report-title { font-size: 13px; color: #A89B8C; margin-top: 4px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
    .meta-card { background: #1e1a15; border: 1px solid #2a2019; border-radius: 10px; padding: 16px 20px; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #6B5E52; margin-bottom: 4px; }
    .meta-value { font-size: 14px; color: #EDE6DD; font-weight: 500; }
    .meta-sub { font-size: 12px; color: #A89B8C; margin-top: 2px; font-family: monospace; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #6B5E52; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; background: #1e1a15; border-radius: 10px; overflow: hidden; border: 1px solid #2a2019; margin-bottom: 32px; }
    thead tr { background: #231e18; }
    th { padding: 10px 14px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6B5E52; font-weight: 600; }
    .summary { background: #1e1a15; border: 1px solid #2a2019; border-radius: 10px; padding: 20px 24px; display: flex; gap: 40px; margin-bottom: 32px; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #6B5E52; margin-bottom: 4px; }
    .stat-value { font-size: 22px; font-weight: 600; color: #C4704B; }
    .footer { font-size: 11px; color: #6B5E52; border-top: 1px solid #2a2019; padding-top: 20px; display: flex; justify-content: space-between; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #C4704B; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
    @media print {
      body { background: white; color: #1a1a1a; padding: 20px; }
      .print-btn { display: none; }
      .header { border-bottom-color: #e5e7eb; }
      .meta-card, table, .summary { background: #f9fafb; border-color: #e5e7eb; }
      .logo { color: #C4704B; }
      .meta-label, .section-title, .stat-label, th { color: #6b7280; }
      .meta-value, .stat-value { color: #111; }
      .meta-sub { color: #6b7280; }
      .footer { border-top-color: #e5e7eb; color: #9ca3af; }
      thead tr { background: #f3f4f6; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">cascrow</div>
        <div class="report-title">Contract Report</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#A89B8C">Generated</div>
        <div style="font-size:13px;color:#EDE6DD">${fmt(new Date())}</div>
        <div style="font-size:11px;font-family:monospace;color:#6B5E52;margin-top:4px">${contract.id}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Requester</div>
        <div class="meta-value">${investorName}</div>
        ${contract.investor.walletAddress ? `<div class="meta-sub">${contract.investor.walletAddress}</div>` : ""}
      </div>
      <div class="meta-card">
        <div class="meta-label">Builder</div>
        <div class="meta-value">${startupName}</div>
        ${contract.startup?.walletAddress ? `<div class="meta-sub">${contract.startup.walletAddress}</div>` : ""}
      </div>
      <div class="meta-card">
        <div class="meta-label">Status</div>
        <div class="meta-value">${STATUS_LABELS[contract.status] ?? contract.status}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Deadline</div>
        <div class="meta-value">${fmt(contract.cancelAfter)}</div>
      </div>
    </div>

    <div class="summary">
      <div>
        <div class="stat-label">Total Value</div>
        <div class="stat-value">${usd(totalAmount)}</div>
        <div style="font-size:11px;color:#A89B8C;margin-top:2px">RLUSD</div>
      </div>
      <div>
        <div class="stat-label">Milestones</div>
        <div class="stat-value">${contract.milestones.length}</div>
        <div style="font-size:11px;color:#A89B8C;margin-top:2px">${completedMs} completed</div>
      </div>
      <div>
        <div class="stat-label">Mode</div>
        <div class="stat-value" style="font-size:16px">${contract.mode}</div>
      </div>
    </div>

    <div class="section-title">Milestones</div>
    <table>
      <thead>
        <tr>
          <th>#</th><th>Title</th><th>Amount</th><th>Deadline</th><th>Status</th><th>AI Verification</th>
        </tr>
      </thead>
      <tbody>${milestoneRows}</tbody>
    </table>

    <div class="footer">
      <span>cascrow · AI-powered milestone escrow · cascrow.com</span>
      <span>Contract ID: ${contract.id}</span>
    </div>
  </div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
