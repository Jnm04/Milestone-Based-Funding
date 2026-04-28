import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { resolveAuth } from "@/lib/api-key-auth";
import { prisma } from "@/lib/prisma";

const MAX_ROWS = 100;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header, strip BOM if present
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseRow(headerLine).map(h => h.toLowerCase().trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_ROWS; i++) {
    const vals = parseRow(lines[i]);
    if (vals.every(v => !v.trim())) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? ""; });
    rows.push(row);
  }
  return rows;
}

function parseRow(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      cols.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const auth = await resolveAuth(req.headers.get("authorization"), session?.user);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.isEnterprise) return NextResponse.json({ error: "Enterprise account required" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const contractTitle = (formData.get("contractTitle") as string | null)?.trim() || null;

  if (!file || !file.name.endsWith(".csv")) {
    return NextResponse.json({ error: "A .csv file is required" }, { status: 400 });
  }
  if (file.size > 500_000) {
    return NextResponse.json({ error: "CSV file must be under 500 KB" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });
  }

  // Validate required columns
  const firstRow = rows[0];
  if (!("title" in firstRow)) {
    return NextResponse.json({ error: "CSV must have a 'title' column" }, { status: 400 });
  }
  if (!("deadline" in firstRow)) {
    return NextResponse.json({ error: "CSV must have a 'deadline' column (YYYY-MM-DD)" }, { status: 400 });
  }

  const milestones: { title: string; deadline: Date; description?: string; verificationCriteria?: string }[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const title = row["title"]?.trim();
    if (!title) { errors.push(`Row ${rowNum}: title is required`); continue; }
    if (title.length > 1000) { errors.push(`Row ${rowNum}: title too long (max 1000 chars)`); continue; }

    const deadlineStr = row["deadline"]?.trim();
    if (!deadlineStr) { errors.push(`Row ${rowNum}: deadline is required`); continue; }
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime())) { errors.push(`Row ${rowNum}: invalid date "${deadlineStr}" — use YYYY-MM-DD`); continue; }
    if (deadline <= new Date()) { errors.push(`Row ${rowNum}: deadline must be in the future`); continue; }

    const description = row["description"]?.trim() || undefined;
    const verificationCriteria = row["verificationcriteria"]?.trim() || row["verification_criteria"]?.trim() || undefined;

    milestones.push({ title, deadline, description, verificationCriteria });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation errors", details: errors }, { status: 400 });
  }
  if (milestones.length === 0) {
    return NextResponse.json({ error: "No valid milestones found in CSV" }, { status: 400 });
  }

  const latestDeadline = milestones.reduce((d, m) => (m.deadline > d ? m.deadline : d), milestones[0].deadline);

  const contract = await prisma.$transaction(async (tx) => {
    const c = await tx.contract.create({
      data: {
        investorId: auth.userId,
        milestone: contractTitle ?? milestones[0].title,
        amountUSD: 0,
        cancelAfter: latestDeadline,
        status: "DRAFT",
        mode: "ATTESTATION",
      },
    });
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      await tx.milestone.create({
        data: {
          contractId: c.id,
          title: m.title,
          description: m.description,
          amountUSD: 0,
          cancelAfter: m.deadline,
          order: i,
          status: "PENDING",
          scheduleType: "ONE_OFF",
          verificationCriteria: m.verificationCriteria ?? null,
        },
      });
    }
    return c;
  });

  return NextResponse.json({ contractId: contract.id, milestoneCount: milestones.length }, { status: 201 });
}
