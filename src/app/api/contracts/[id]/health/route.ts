import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

const NOTE_TTL_MS = 24 * 60 * 60 * 1000;

export type DealHealth = "GREEN" | "YELLOW" | "RED";

export interface HealthResponse {
  health: DealHealth;
  note: string | null;
  noteUpdatedAt: string | null;
  fromCache: boolean;
}

/**
 * GET /api/contracts/[id]/health
 *
 * Returns traffic-light deal health + optional AI-generated single-sentence note.
 * Only accessible by the investor on this contract.
 * Note is cached for 24 hours.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: contractId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      investorId: true,
      status: true,
      cancelAfter: true,
      healthNote: true,
      healthNoteUpdatedAt: true,
      milestones: {
        select: { status: true, cancelAfter: true, title: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.investorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Compute traffic-light health ──────────────────────────────────────────
  const health = computeHealth(contract);

  // ── Return cached note if fresh ───────────────────────────────────────────
  if (
    contract.healthNote &&
    contract.healthNoteUpdatedAt &&
    Date.now() - contract.healthNoteUpdatedAt.getTime() < NOTE_TTL_MS
  ) {
    return NextResponse.json({
      health,
      note: contract.healthNote,
      noteUpdatedAt: contract.healthNoteUpdatedAt.toISOString(),
      fromCache: true,
    } satisfies HealthResponse);
  }

  // ── Skip AI note for terminal statuses ────────────────────────────────────
  const terminalStatuses = ["COMPLETED", "EXPIRED", "DECLINED", "DRAFT"];
  if (terminalStatuses.includes(contract.status)) {
    return NextResponse.json({
      health,
      note: null,
      noteUpdatedAt: null,
      fromCache: false,
    } satisfies HealthResponse);
  }

  // ── Rate limit: 30 note generations per hour per user ─────────────────────
  const ip = getClientIp(req);
  const allowed = await checkRateLimit(`health-note:${session.user.id ?? ip}`, 30, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  // ── Build context for AI ──────────────────────────────────────────────────
  const now = new Date();
  const activeMilestone = contract.milestones.find(
    (m) => !["COMPLETED", "PENDING"].includes(m.status)
  );
  const deadline = activeMilestone?.cancelAfter ?? contract.cancelAfter;
  const daysLeft = Math.round((new Date(deadline).getTime() - now.getTime()) / 86_400_000);

  const recentUpdates = await prisma.progressUpdate.count({
    where: {
      milestone: { contractId },
      createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
  });

  const contextLines = [
    `Contract status: ${contract.status}`,
    activeMilestone
      ? `Active milestone: "${activeMilestone.title}" (status: ${activeMilestone.status})`
      : `Overall status: ${contract.status}`,
    daysLeft >= 0
      ? `Days until deadline: ${daysLeft}`
      : `Deadline overdue by: ${Math.abs(daysLeft)} days`,
    `Recent progress updates (last 14 days): ${recentUpdates}`,
    `Deal health signal: ${health}`,
  ];

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `You are a deal health analyst for a milestone-based grant escrow platform.
Write a single sentence (max 20 words) summarizing the current deal health for an investor dashboard.
Be direct and investor-facing. Focus on the most actionable insight.
Respond with ONLY the sentence, no quotation marks, no punctuation at the very start.`,
      messages: [
        {
          role: "user",
          content: `Generate a one-sentence deal health note:\n\n${contextLines.join("\n")}`,
        },
      ],
    });

    const note =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim().replace(/^["']|["']$/g, "")
        : null;

    if (note) {
      await prisma.contract.update({
        where: { id: contractId },
        data: { healthNote: note, healthNoteUpdatedAt: now },
      });

      void prisma.apiUsage
        .create({
          data: {
            model: "Claude Haiku",
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            estimatedCostUsd:
              (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) / 1_000_000,
            context: "health-note",
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      health,
      note: note ?? null,
      noteUpdatedAt: note ? now.toISOString() : null,
      fromCache: false,
    } satisfies HealthResponse);
  } catch (err) {
    console.error("[health] AI note generation failed:", err);
    // Return health without note — never fail the request
    return NextResponse.json({
      health,
      note: contract.healthNote ?? null,
      noteUpdatedAt: contract.healthNoteUpdatedAt?.toISOString() ?? null,
      fromCache: true,
    } satisfies HealthResponse);
  }
}

// ── Pure health computation ────────────────────────────────────────────────────

function computeHealth(contract: {
  status: string;
  cancelAfter: Date;
  milestones: { status: string; cancelAfter: Date }[];
}): DealHealth {
  const terminalStatuses = ["COMPLETED", "EXPIRED", "DECLINED", "DRAFT"];
  if (terminalStatuses.includes(contract.status)) return "GREEN";
  if (contract.status === "RENEGOTIATING") return "RED";

  const activeMilestone = contract.milestones.find(
    (m) => !["COMPLETED", "PENDING"].includes(m.status)
  );
  const deadline = activeMilestone?.cancelAfter ?? contract.cancelAfter;

  if (new Date(deadline) < new Date()) return "RED";

  const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86_400_000;
  if (daysLeft <= 7 && ["AWAITING_ESCROW", "FUNDED"].includes(contract.status)) return "YELLOW";

  return "GREEN";
}
