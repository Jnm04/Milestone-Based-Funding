import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const ALLOWED_TAGS = new Set([
  // CSRD / ESRS
  "CSRD:E1", "CSRD:E2", "CSRD:E3", "CSRD:E4", "CSRD:E5",
  "CSRD:S1", "CSRD:S2", "CSRD:S3", "CSRD:S4",
  "CSRD:G1",
  // GRI
  "GRI:201", "GRI:202", "GRI:203", "GRI:204", "GRI:205",
  "GRI:302", "GRI:303", "GRI:304", "GRI:305", "GRI:306", "GRI:308",
  "GRI:401", "GRI:403", "GRI:404", "GRI:405", "GRI:406",
  // SDG
  "SDG:1","SDG:2","SDG:3","SDG:4","SDG:5","SDG:6","SDG:7","SDG:8",
  "SDG:9","SDG:10","SDG:11","SDG:12","SDG:13","SDG:14","SDG:15","SDG:16","SDG:17",
  // TCFD
  "TCFD:GOVERNANCE","TCFD:STRATEGY","TCFD:RISK","TCFD:METRICS",
  // ISO
  "ISO:14001","ISO:45001","ISO:50001","ISO:26000",
]);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, milestoneId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, mode: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.investorId !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.mode !== "ATTESTATION")
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  let body: { tags?: unknown };
  try {
    body = (await req.json()) as { tags?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
  }

  const tags = (body.tags as unknown[]).filter((t): t is string => typeof t === "string" && ALLOWED_TAGS.has(t));

  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId, contractId } });
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { regulatoryTags: JSON.stringify(tags) },
  });

  return NextResponse.json({ success: true, tags });
}
