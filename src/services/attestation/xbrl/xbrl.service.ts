import { put } from "@vercel/blob";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { ESRS_CONCEPTS, ESRS_ARTICLE_TO_CONCEPTS } from "./esrs-concepts";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
let _anthropic: Anthropic | null = null;
const getAnthropic = () => (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export interface XbrlGenerationOptions {
  contractId: string;
  period: string;
  taxonomy: "ESRS";
  companyName: string;
  leiCode?: string;
  reportingCurrency?: string;
}

export interface XbrlResult {
  reportId: string;
  blobUrl: string;
  conceptsTagged: number;
  untaggedMilestones: string[];
  period: string;
}

interface RegMapItem { framework: string; article: string; clause?: string; confidence: number }

async function extractNumericValue(text: string, conceptTag: string): Promise<string | null> {
  const anthropic = getAnthropic();
  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 64,
      system: `Extract only the numeric value for "${conceptTag}" from the text. Respond with just the number (no units, no currency symbols, no commas). If not found, respond with "null".`,
      messages: [{ role: "user", content: text.slice(0, 2000) }],
    });
    const val = res.content[0]?.type === "text" ? res.content[0].text.trim() : "null";
    return val === "null" ? null : val.replace(/[^0-9.-]/g, "") || null;
  } catch {
    return null;
  }
}

export async function generateXbrlReport(options: XbrlGenerationOptions): Promise<XbrlResult> {
  const { contractId, period, companyName, leiCode, reportingCurrency = "EUR" } = options;

  const entries = await prisma.attestationEntry.findMany({
    where: { milestone: { contractId }, aiVerdict: "YES" },
    include: { milestone: { select: { title: true } } },
    orderBy: { fetchedAt: "asc" },
  });

  const [startDate, endDate] = period.includes("Q")
    ? (() => {
        const [y, q] = period.split("-Q");
        const qNum = parseInt(q);
        const startMonth = (qNum - 1) * 3 + 1;
        const endMonth = qNum * 3;
        return [`${y}-${String(startMonth).padStart(2, "0")}-01`, `${y}-${String(endMonth).padStart(2, "0")}-${[0,31,28,31,30,31,30,31,31,30,31,30,31][endMonth]}`];
      })()
    : [`${period}-01-01`, `${period}-12-31`];

  const facts: { tag: string; unit: string; value: string; decimals: string }[] = [];
  const untaggedMilestones: string[] = [];

  for (const entry of entries) {
    const regMap = Array.isArray(entry.regulatoryMapping) ? (entry.regulatoryMapping as unknown as RegMapItem[]) : [];
    const esrsArticles = regMap
      .filter((m) => m.framework === "CSRD" && m.confidence >= 0.6)
      .map((m) => m.article);

    const conceptKeys = new Set<string>();
    for (const article of esrsArticles) {
      (ESRS_ARTICLE_TO_CONCEPTS[article] ?? []).forEach((k) => conceptKeys.add(k));
    }

    if (conceptKeys.size === 0) {
      untaggedMilestones.push(entry.milestone.title);
      continue;
    }

    for (const key of conceptKeys) {
      const concept = ESRS_CONCEPTS[key];
      if (!concept) continue;
      const value = await extractNumericValue(entry.aiReasoning, concept.tag);
      if (!value) continue;
      facts.push({
        tag: concept.tag,
        unit: concept.dataType === "decimal" ? reportingCurrency : concept.unit,
        value,
        decimals: concept.dataType === "integer" ? "0" : "2",
      });
    }
  }

  const entityEl = leiCode
    ? `<xbrli:identifier scheme="http://standards.iso.org/iso/17442">${leiCode}</xbrli:identifier>`
    : `<xbrli:identifier scheme="http://www.cascrow.com/entity">${companyName.replace(/[^a-zA-Z0-9]/g, "_")}</xbrli:identifier>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:esrs="https://xbrl.efrag.org/taxonomy/esrs/2024-10-29"
      xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:cascrow="https://cascrow.com/xbrl/extension"
      xsi:schemaLocation="https://xbrl.efrag.org/taxonomy/esrs/2024-10-29 esrs-all.xsd"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <xbrli:context id="CTX_${period.replace(/[^a-zA-Z0-9]/g, "_")}">
    <xbrli:entity>
      ${entityEl}
    </xbrli:entity>
    <xbrli:period>
      <xbrli:startDate>${startDate}</xbrli:startDate>
      <xbrli:endDate>${endDate}</xbrli:endDate>
    </xbrli:period>
  </xbrli:context>

  <!-- Attestation provenance — cascrow extension -->
  <cascrow:AttestationPlatform contextRef="CTX_${period.replace(/[^a-zA-Z0-9]/g, "_")}">cascrow.com</cascrow:AttestationPlatform>
  <cascrow:AttestationCount contextRef="CTX_${period.replace(/[^a-zA-Z0-9]/g, "_")}">${entries.length}</cascrow:AttestationCount>

${facts
  .map(
    (f) =>
      `  <${f.tag} contextRef="CTX_${period.replace(/[^a-zA-Z0-9]/g, "_")}" decimals="${f.decimals}">${f.value}</${f.tag}>`
  )
  .join("\n")}

</xbrl>`;

  const blob = await put(
    `reports/xbrl/${contractId}/${period}-esrs.xbrl`,
    xml,
    { access: "public", contentType: "application/xml" }
  );

  const report = await prisma.report.create({
    data: { contractId, period, type: "XBRL_ESRS", blobUrl: blob.url },
  });

  return {
    reportId: report.id,
    blobUrl: blob.url,
    conceptsTagged: facts.length,
    untaggedMilestones,
    period,
  };
}
