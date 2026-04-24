import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { createContractSchema } from "@/lib/zod-schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPostHogClient } from "@/lib/posthog-server";
import Anthropic from "@anthropic-ai/sdk";
import { encryptGoal, hashGoal } from "@/lib/confidential";

// ─── Lazy Anthropic client ────────────────────────────────────────────────────
let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ─── Feature J: AI Contract Risk Flags ───────────────────────────────────────
// Best-effort, non-blocking. Fires after contract is created and response sent.
async function generateAndStoreRiskFlags(
  contractId: string,
  milestones: { title: string; amountUSD: number; cancelAfter: string }[]
) {
  const milestoneLines = milestones.map((m, i) => {
    const deadlineDays = Math.round(
      (new Date(m.cancelAfter).getTime() - Date.now()) / 86_400_000
    );
    return `${i + 1}. "${m.title}" — $${m.amountUSD} RLUSD, deadline in ${deadlineDays} days`;
  });

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `You are a contract risk analyst for a milestone-based grant escrow platform.
Review the milestone plan and identify structural problems that could cause disputes or failed verifications.
Respond ONLY with valid JSON (no markdown, no code blocks): [{"severity": "WARNING"|"INFO", "text": "string"}]

Rules:
- Return an empty array [] if no issues found
- Maximum 5 flags
- "WARNING": real risk — vague/unverifiable milestone, unrealistic deadline, disproportionate amount, multiple distinct deliverables bundled
- "INFO": advisory — suggestion to strengthen the plan, not a blocker
- text: one concise sentence, actionable, references the specific milestone by number
- Do NOT flag things that are fine. Only flag genuine structural issues.`,
    messages: [
      {
        role: "user",
        content: `Review this milestone plan for structural risks:\n\n${milestoneLines.join("\n")}`,
      },
    ],
  });

  const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]";
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const flags = JSON.parse(jsonText) as Array<{ severity: string; text: string }>;

  const validated = flags
    .filter(
      (f) =>
        typeof f.text === "string" &&
        f.text.length > 0 &&
        ["WARNING", "INFO"].includes(f.severity)
    )
    .slice(0, 5);

  if (validated.length > 0) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { riskFlags: validated as never },
    });
  }

  void prisma.apiUsage
    .create({
      data: {
        model: "Claude Haiku",
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedCostUsd:
          (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
        context: "risk-flags",
      },
    })
    .catch(() => {});
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // 20 contract creations per user per hour — prevents DB/webhook spam
    if (!(await checkRateLimit(`create-contract:${session.user.id}`, 20, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many contracts created. Please wait before trying again." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = await request.json();

    // Zod: catches missing fields, wrong types, oversized strings, too many milestones
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const {
      milestone,
      amountUSD,
      cancelAfter,
      milestones: milestonesInput,
      receiverWalletAddress,
      mode = "ESCROW",
      auditorEmail,
      attestationMilestones,
      isConfidential,
      confidentialPassphrase,
    } = parsed.data;

    const isAttestation = mode === "ATTESTATION";

    // ATTESTATION mode: no wallet required — no financial flows
    if (!isAttestation && !session.user.walletAddress) {
      return NextResponse.json(
        { error: "Connect your XRPL wallet before creating a contract" },
        { status: 422 }
      );
    }

    const investor = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!investor) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (isAttestation && !investor.isEnterprise) {
      return NextResponse.json(
        { error: "Enterprise Attestation Mode is not enabled for your account. Request access from the team." },
        { status: 403 }
      );
    }

    // KYC tier limits — ESCROW mode only
    if (!isAttestation) {
      const KYC_LIMITS: Record<number, number> = { 0: 1_000, 1: 10_000 };
      const tierLimit = KYC_LIMITS[investor.kycTier];
      if (tierLimit !== undefined) {
        const msData_pre: { amountUSD: number }[] =
          (milestonesInput ?? [{ amountUSD }]).map((m: { amountUSD: unknown }) => ({ amountUSD: Number(m.amountUSD) }));
        const totalUSD = msData_pre.reduce((sum, m) => sum + m.amountUSD, 0);
        if (totalUSD > tierLimit) {
          const tierLabel = `Your account is limited to $${tierLimit.toLocaleString()} per contract. Complete identity verification to increase your limit.`;
          return NextResponse.json({ error: tierLabel, kycTier: investor.kycTier, limit: tierLimit }, { status: 403 });
        }
      }
    }

    // If a receiver wallet was provided, look up that user now (ESCROW only)
    let receiver: { id: string } | null = null;
    if (!isAttestation && receiverWalletAddress) {
      receiver = await prisma.user.findUnique({
        where: { walletAddress: receiverWalletAddress },
      });
      if (!receiver) {
        return NextResponse.json(
          { error: "No account found with that wallet address. The Receiver must register first." },
          { status: 404 }
        );
      }
    }

    const inviteLink = nanoid(32);

    // ── ATTESTATION MODE path ─────────────────────────────────────────────────
    if (isAttestation) {
      const atMs = attestationMilestones!;
      const latestDeadline = atMs.reduce(
        (latest, m) => (m.cancelAfter > latest ? m.cancelAfter : latest),
        atMs[0].cancelAfter
      );

      const result = await prisma.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            investorId: investor.id,
            milestone: atMs[0].title,
            amountUSD: 0,
            cancelAfter: new Date(latestDeadline),
            status: "DRAFT",
            mode: "ATTESTATION",
            auditorEmail: auditorEmail ?? null,
          },
        });

        for (let i = 0; i < atMs.length; i++) {
          const m = atMs[i];
          let encryptedGoalVal: string | null = null;
          let goalHashVal: string | null = null;

          if (isConfidential && confidentialPassphrase) {
            const salt = contract.id + "-" + i;
            encryptedGoalVal = encryptGoal(m.title, null, confidentialPassphrase);
            goalHashVal = hashGoal(m.title, null, salt);
          }

          await tx.milestone.create({
            data: {
              contractId: contract.id,
              title: isConfidential ? "Confidential Goal" : m.title,
              amountUSD: m.amountUSD ?? 0,
              cancelAfter: new Date(m.cancelAfter),
              order: i,
              status: "PENDING",
              scheduleType: m.scheduleType ?? "ONE_OFF",
              isConfidential: isConfidential ?? false,
              encryptedGoal: encryptedGoalVal,
              goalHash: goalHashVal,
              verificationCriteria: m.verificationCriteria ?? null,
            },
          });
        }

        return contract;
      });

      await writeAuditLog({
        contractId: result.id,
        event: "ATTESTATION_CONTRACT_CREATED",
        actor: session.user.id,
        metadata: { milestoneCount: atMs.length, mode: "ATTESTATION" },
      });

      getPostHogClient().capture({
        distinctId: session.user.id,
        event: "attestation_contract_created",
        properties: { contract_id: result.id, milestone_count: atMs.length },
      });

      return NextResponse.json({ contractId: result.id, inviteLink: null, directlyLinked: false });
    }

    // ── ESCROW MODE path ──────────────────────────────────────────────────────
    let msData: { title: string; amountUSD: number; cancelAfter: string; dependsOnIndex?: number }[];
    if (milestonesInput) {
      msData = milestonesInput;
    } else {
      if (!milestone || amountUSD === undefined || !cancelAfter) {
        return NextResponse.json(
          { error: "milestone, amountUSD, and cancelAfter are required" },
          { status: 400 }
        );
      }
      msData = [{ title: milestone, amountUSD, cancelAfter }];
    }

    for (const m of msData) {
      const amt = Number(m.amountUSD);
      if (!Number.isFinite(amt) || amt <= 0 || amt > 999_999_999) {
        return NextResponse.json({ error: "Invalid amount: must be between 0 and 999,999,999" }, { status: 400 });
      }
      if (Math.round(amt * 100) !== amt * 100) {
        return NextResponse.json({ error: "Invalid amount: max 2 decimal places allowed" }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const totalAmount = msData.reduce(
        (sum: number, m: { amountUSD: number }) => sum + Number(m.amountUSD),
        0
      );
      const latestDeadline = msData.reduce(
        (latest: string, m: { cancelAfter: string }) =>
          m.cancelAfter > latest ? m.cancelAfter : latest,
        msData[0].cancelAfter
      );

      const directLink = receiver ? null : inviteLink;
      const contractStatus = receiver ? "AWAITING_ESCROW" : "DRAFT";
      const milestoneStatus = receiver ? "AWAITING_ESCROW" : "PENDING";

      const contract = await tx.contract.create({
        data: {
          investorId: investor.id,
          startupId: receiver?.id ?? null,
          milestone: milestone ?? msData[0].title,
          amountUSD: totalAmount,
          cancelAfter: new Date(latestDeadline),
          inviteLink: directLink,
          status: contractStatus,
        },
      });

      // Create milestones individually so we can set dependsOnMilestoneId by index
      const createdMilestoneIds: string[] = [];
      for (let i = 0; i < msData.length; i++) {
        const m = msData[i];
        const depId = m.dependsOnIndex !== undefined && m.dependsOnIndex < i
          ? createdMilestoneIds[m.dependsOnIndex]
          : null;
        const ms = await tx.milestone.create({
          data: {
            contractId: contract.id,
            title: m.title,
            amountUSD: m.amountUSD,
            cancelAfter: new Date(m.cancelAfter),
            order: i,
            status: milestoneStatus,
            dependsOnMilestoneId: depId ?? null,
          },
        });
        createdMilestoneIds.push(ms.id);
      }

      return contract;
    });

    await writeAuditLog({
      contractId: result.id,
      event: "CONTRACT_CREATED",
      actor: session.user.id,
      metadata: { milestoneCount: result.id ? 1 : 0 },
    });

    fireWebhook({
      investorId: investor.id,
      startupId: receiver?.id ?? undefined,
      event: "contract.created",
      contractId: result.id,
      data: {
        milestone: milestone ?? result.milestone,
        amountUSD: result.amountUSD.toString(),
        cancelAfter: result.cancelAfter.toISOString(),
      },
    }).catch((err) => console.error("[webhook] contract.created failed:", err));

    getPostHogClient().capture({
      distinctId: session.user.id,
      event: "contract_created",
      properties: {
        contract_id: result.id,
        milestone_count: msData.length,
        total_amount_usd: msData.reduce((s, m) => s + Number(m.amountUSD), 0),
        directly_linked: !!receiver,
      },
    });

    // Feature J: generate AI risk flags — best-effort, never blocks the response
    if (process.env.ANTHROPIC_API_KEY) {
      generateAndStoreRiskFlags(result.id, msData).catch((err) =>
        console.warn("[contracts] Risk flag generation failed:", err)
      );
    }

    return NextResponse.json({
      contractId: result.id,
      inviteLink: receiver ? null : inviteLink,
      directlyLinked: !!receiver,
    });
  } catch (err) {
    console.error("Create contract error:", err);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10) || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const skip   = (page - 1) * limit;
    const VALID_STATUSES = new Set([
      "DRAFT","AWAITING_ESCROW","FUNDED","PROOF_SUBMITTED",
      "VERIFIED","REJECTED","EXPIRED","COMPLETED","DECLINED",
    ]);
    const rawStatus = searchParams.get("status") ?? undefined;
    const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const where = {
      ...(session.user.role === "INVESTOR"
        ? { investorId: session.user.id }
        : { startupId: session.user.id }),
      ...(status ? { status: status as "DRAFT" | "AWAITING_ESCROW" | "FUNDED" | "PROOF_SUBMITTED" | "VERIFIED" | "REJECTED" | "EXPIRED" | "COMPLETED" | "DECLINED" } : {}),
      ...(search
        ? { milestone: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        include: {
          investor: true,
          startup: true,
          milestones: { select: { status: true, cancelAfter: true }, orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.contract.count({ where }),
    ]);

    return NextResponse.json({ contracts, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("List contracts error:", err);
    return NextResponse.json({ error: "Failed to list contracts", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
