import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { generateXbrlReport } from "@/services/attestation/xbrl/xbrl.service";

export const maxDuration = 60;

const schema = z.object({
  contractId:        z.string().min(1).max(50),
  period:            z.string().regex(/^\d{4}(-Q[1-4]|-\d{2})?$/),
  taxonomy:          z.enum(["ESRS"]),
  companyName:       z.string().min(1).max(200),
  leiCode:           z.string().regex(/^[A-Z0-9]{20}$/).optional(),
  reportingCurrency: z.string().length(3).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rlAllowed = await checkRateLimit(`xbrl-report:${session.user.id}`, 10, 3600);
  if (!rlAllowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { contractId, period, taxonomy, companyName, leiCode, reportingCurrency } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { investorId: true, auditorEmail: true, mode: true },
  });

  if (!contract || contract.mode !== "ATTESTATION") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    contract.investorId !== session.user.id &&
    contract.auditorEmail !== session.user.email
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await generateXbrlReport({ contractId, period, taxonomy, companyName, leiCode, reportingCurrency });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[xbrl] generation failed:", err);
    return NextResponse.json({ error: "XBRL generation failed" }, { status: 500 });
  }
}
