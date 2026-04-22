import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { encryptApiKey } from "@/lib/encrypt";
import { z } from "zod";

const lockSourceSchema = z.object({
  dataSourceType: z.enum(["URL_SCRAPE", "REST_API", "FILE_UPLOAD", "MANUAL_REVIEW"]),
  dataSourceUrl: z.string().url("Must be a valid URL").max(2000).optional(),
  apiKey: z.string().max(1000).optional(),
  dataSourceConfig: z
    .object({
      method: z.enum(["GET", "POST"]).optional(),
      headers: z.record(z.string()).optional(),
      responsePath: z.string().max(200).optional(),
    })
    .optional(),
  scheduleType: z.enum(["ONE_OFF", "MONTHLY", "QUARTERLY", "ANNUAL"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });
  }

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  if (milestone.dataSourceLockedAt) {
    return NextResponse.json({ error: "Data source is already locked and cannot be changed" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = lockSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { dataSourceType, dataSourceUrl, apiKey, dataSourceConfig, scheduleType } = parsed.data;

  if (dataSourceType === "URL_SCRAPE" && !dataSourceUrl) {
    return NextResponse.json({ error: "dataSourceUrl is required for URL_SCRAPE" }, { status: 400 });
  }
  if (dataSourceType === "REST_API" && (!dataSourceUrl || !apiKey)) {
    return NextResponse.json({ error: "dataSourceUrl and apiKey are required for REST_API" }, { status: 400 });
  }

  let dataSourceApiKeyEnc: string | null = null;
  let dataSourceApiKeyHint: string | null = null;
  if (apiKey) {
    dataSourceApiKeyEnc = encryptApiKey(apiKey);
    dataSourceApiKeyHint = apiKey.slice(-4);
  }

  // Calculate next run date for recurring schedules
  let scheduleNextRun: Date | null = null;
  if (scheduleType && scheduleType !== "ONE_OFF") {
    const base = new Date();
    if (scheduleType === "MONTHLY") {
      scheduleNextRun = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    } else if (scheduleType === "QUARTERLY") {
      const q = Math.floor(base.getMonth() / 3);
      scheduleNextRun = new Date(base.getFullYear(), (q + 1) * 3, 1);
    } else if (scheduleType === "ANNUAL") {
      scheduleNextRun = new Date(base.getFullYear() + 1, 0, 1);
    }
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      dataSourceType,
      dataSourceUrl: dataSourceUrl ?? null,
      dataSourceApiKeyEnc,
      dataSourceApiKeyHint,
      dataSourceConfig: dataSourceConfig ?? undefined,
      dataSourceLockedAt: new Date(),
      scheduleType: scheduleType ?? milestone.scheduleType ?? "ONE_OFF",
      scheduleNextRun,
    },
    select: {
      id: true,
      dataSourceType: true,
      dataSourceUrl: true,
      dataSourceApiKeyHint: true,
      dataSourceLockedAt: true,
      scheduleType: true,
      scheduleNextRun: true,
    },
  });

  return NextResponse.json({ success: true, milestone: updated });
}
