import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { resolveAuth } from "@/lib/api-key-auth";
import { put } from "@vercel/blob";
import { getEnterpriseContext } from "@/lib/enterprise-context";

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
  return `<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:.04em;color:${cfg.color};background:${cfg.bg}">${cfg.label}</span>`;
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
  return `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;letter-spacing:.04em;color:${color};background:${bg};margin:2px 2px 0">${esc(tag)}</span>`;
}

// Collect all unique regulatory tags across all milestones
function buildRegulatoryTable(milestones: { regulatoryTags: unknown }[]): string {
  const seen = new Set<string>();
  for (const m of milestones) {
    const tags = (m.regulatoryTags as unknown as string[]) ?? [];
    for (const t of tags) seen.add(t);
  }
  if (seen.size === 0) return "";

  const byFramework: Record<string, string[]> = {};
  for (const tag of seen) {
    const prefix = tag.split(":")[0];
    if (!byFramework[prefix]) byFramework[prefix] = [];
    byFramework[prefix].push(tag);
  }

  const rows = Object.entries(byFramework).map(([fw, tags]) =>
    `<tr>
      <td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #F3F4F6">${esc(fw)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #F3F4F6">${tags.map(tagBadge).join(" ")}</td>
    </tr>`
  ).join("");

  return `
    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:40px 0 12px">Regulatory Coverage</h2>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:13px">
      <thead>
        <tr style="background:#F9FAFB">
          <th style="padding:10px 14px;text-align:left;font-weight:700;color:#6B7280;font-size:11px;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #E5E7EB">Framework</th>
          <th style="padding:10px 14px;text-align:left;font-weight:700;color:#6B7280;font-size:11px;letter-spacing:.05em;text-transform:uppercase;border-bottom:1px solid #E5E7EB">Articles Covered</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise access required" }, { status: 403 });

  const { id } = await params;
  const { effectiveUserId } = await getEnterpriseContext(auth.userId);

  const body = await req.json().catch(() => null) as { period?: string } | null;
  const period = body?.period ?? `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`;

  const contract = await prisma.contract.findUnique({
    where: { id },
    select: { investorId: true, mode: true, milestone: true, createdAt: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION") return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });
  if (contract.investorId !== effectiveUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: effectiveUserId },
    select: { name: true, companyName: true },
  });

  const milestones = await prisma.milestone.findMany({
    where: { contractId: id },
    orderBy: { order: "asc" },
    include: {
      attestationEntries: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true, period: true, aiVerdict: true, aiReasoning: true,
          certUrl: true, xrplTxHash: true, createdAt: true,
        },
      },
    },
  });

  const verifiedCount = milestones.filter((m) => ["VERIFIED", "COMPLETED"].includes(m.status)).length;
  const totalMilestones = milestones.length;
  const completionPct = totalMilestones > 0 ? Math.round((verifiedCount / totalMilestones) * 100) : 0;
  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const companyName = user?.companyName ?? user?.name ?? "Your Organisation";

  const milestoneSections = milestones.map((m, idx) => {
    const latest = m.attestationEntries[0];
    const tags = (m.regulatoryTags as unknown as string[]) ?? [];
    const statusColor = ["VERIFIED", "COMPLETED"].includes(m.status) ? "#065F46" : m.status === "REJECTED" ? "#991B1B" : "#92400E";
    const statusBg = ["VERIFIED", "COMPLETED"].includes(m.status) ? "#D1FAE5" : m.status === "REJECTED" ? "#FEE2E2" : "#FEF3C7";

    return `
      <div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:24px;margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:12px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;color:#9CA3AF;width:20px;text-align:right;flex-shrink:0">${idx + 1}</span>
              <h3 style="font-size:15px;font-weight:700;color:#111827;margin:0">${esc(m.title)}</h3>
              <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;color:${statusColor};background:${statusBg}">${m.status}</span>
            </div>
            ${m.description ? `<p style="margin:0 0 8px 28px;font-size:13px;color:#6B7280;line-height:1.55">${esc(m.description)}</p>` : ""}
            ${tags.length > 0 ? `<div style="margin-left:28px">${tags.map(tagBadge).join("")}</div>` : ""}
          </div>
        </div>
        ${latest ? `
        <div style="margin-top:14px;padding:14px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:${latest.aiReasoning ? "10px" : "0"}">
            <span style="font-size:12px;font-weight:600;color:#6B7280">Latest attestation — ${esc(latest.period ?? "")}</span>
            ${verdictBadge(latest.aiVerdict ?? "")}
          </div>
          ${latest.aiReasoning ? `<p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6">${esc(latest.aiReasoning.slice(0, 600))}${latest.aiReasoning.length > 600 ? "…" : ""}</p>` : ""}
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${latest.xrplTxHash ? `<a href="${XRPL_EXPLORER}/transactions/${esc(latest.xrplTxHash)}" style="font-size:12px;color:#2563EB;text-decoration:none">↗ On-chain proof</a>` : ""}
            ${latest.certUrl ? `<a href="${esc(latest.certUrl)}" style="font-size:12px;color:#2563EB;text-decoration:none">↗ Download certificate</a>` : ""}
          </div>
        </div>` : `
        <p style="margin:12px 0 0;font-size:13px;color:#9CA3AF;font-style:italic">No attestation runs yet.</p>`}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(companyName)} — ESG Transparency Report ${esc(period)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #F9FAFB; color: #111827; }
    .container { max-width: 820px; margin: 0 auto; padding: 40px 24px 80px; }
  </style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:40px;padding-bottom:24px;border-bottom:2px solid #E5E7EB">
    <div>
      <h1 style="font-size:26px;font-weight:800;color:#111827;margin:0 0 4px;letter-spacing:-0.02em">${esc(companyName)}</h1>
      <p style="margin:0;font-size:14px;color:#6B7280">ESG Transparency Report · ${esc(period)}</p>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px">Generated on</div>
      <div style="font-size:13px;color:#374151;font-weight:600">${generatedAt}</div>
    </div>
  </div>

  <!-- Progress summary -->
  <div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:24px;margin-bottom:28px">
    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 16px">Executive Summary</h2>
    <div style="display:flex;gap:24px;flex-wrap:wrap;margin-bottom:20px">
      <div>
        <div style="font-size:32px;font-weight:800;color:#111827;line-height:1">${verifiedCount}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px">of ${totalMilestones} goals verified</div>
      </div>
      <div>
        <div style="font-size:32px;font-weight:800;color:${completionPct === 100 ? "#16A34A" : "#2563EB"};line-height:1">${completionPct}%</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px">completion rate</div>
      </div>
    </div>
    <div style="background:#F3F4F6;border-radius:8px;overflow:hidden;height:10px;width:100%">
      <div style="height:100%;width:${completionPct}%;background:${completionPct === 100 ? "#16A34A" : "#2563EB"};border-radius:8px;transition:width .4s"></div>
    </div>
  </div>

  <!-- Milestone sections -->
  <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 14px">Tracked Goals & Evidence</h2>
  ${milestoneSections}

  <!-- Regulatory coverage -->
  ${buildRegulatoryTable(milestones)}

  <!-- Methodology -->
  <div style="margin-top:40px;padding:20px 24px;background:white;border:1px solid #E5E7EB;border-radius:12px">
    <h3 style="font-size:14px;font-weight:700;color:#374151;margin:0 0 8px">Verification Methodology</h3>
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65">
      All attestations in this report were performed by an independent 5-model AI consensus (Claude, GPT-4o, Gemini, Mistral, Cerebras). A minimum of 3 out of 5 models must reach agreement for a goal to be marked as VERIFIED. Every verdict is permanently anchored on the XRP Ledger blockchain, providing a tamper-proof audit trail accessible to any third party. Data sources are pre-committed and locked before verification runs.
    </p>
  </div>

  <!-- Footer -->
  <div style="margin-top:40px;text-align:center;font-size:12px;color:#9CA3AF">
    Verified by <a href="https://cascrow.com" style="color:#6B7280;text-decoration:none;font-weight:600">cascrow.com</a> · Report ID: ${esc(id)}-${esc(period.replace(/\s/g, "-"))}
  </div>
</div>
</body>
</html>`;

  const blob = await put(
    `transparency-reports/${id}/${period.replace(/\s/g, "-")}.html`,
    html,
    { access: "public", contentType: "text/html; charset=utf-8" }
  );

  await prisma.user.update({
    where: { id: effectiveUserId },
    data: {
      lastTransparencyReportUrl: blob.url,
      lastTransparencyReportPeriod: period,
    },
  });

  return NextResponse.json({ url: blob.url, period });
}
