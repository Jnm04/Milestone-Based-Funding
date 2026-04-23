import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

function esc(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
    select: { investorId: true, auditorEmail: true, mode: true, milestone: true },
  });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.mode !== "ATTESTATION")
    return NextResponse.json({ error: "Not an attestation contract" }, { status: 400 });

  const isOwner = contract.investorId === session.user.id;
  const isAuditor = contract.auditorEmail === session.user.email;
  if (!isOwner && !isAuditor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const milestones = await prisma.milestone.findMany({
    where: { contractId: id },
    orderBy: { order: "asc" },
    include: {
      attestationEntries: {
        orderBy: { createdAt: "desc" },
        select: {
          period: true,
          aiVerdict: true,
          aiReasoning: true,
          certUrl: true,
          xrplTxHash: true,
          fetchedHash: true,
          fetchedAt: true,
          type: true,
          auditorEmail: true,
        },
      },
    },
  });

  const header = "goal_set,milestone_title,period,verdict,reasoning,cert_url,xrpl_tx,evidence_hash,run_at,type,auditor\n";
  const rows = milestones.flatMap((m) =>
    m.attestationEntries.map((e) =>
      [
        esc(contract.milestone),
        esc(m.title),
        esc(e.period),
        esc(e.aiVerdict),
        esc(e.aiReasoning),
        esc(e.certUrl),
        esc(e.xrplTxHash),
        esc(e.fetchedHash),
        esc(e.fetchedAt?.toISOString()),
        esc(e.type),
        esc(e.auditorEmail),
      ].join(",")
    )
  );

  const csv = header + rows.join("\n");
  const filename = `attestation-${id.slice(0, 8)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
