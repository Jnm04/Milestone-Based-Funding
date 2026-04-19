import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import {
  sendCounterProposalSubmittedEmail,
} from "@/lib/email";

/**
 * Feature Z: Contract Counter-Proposal
 *
 * GET  /api/contracts/[id]/counter-proposal
 *   Returns the current counter-proposal for the contract (if any).
 *   Auth: investor or startup on the contract.
 *
 * POST /api/contracts/[id]/counter-proposal
 *   Startup submits a counter-proposal before accepting an invite.
 *   Body: { milestoneChanges, rationale, improveWithAi? }
 *   Auth: startup role, must not be the investor.
 */

export interface MilestoneChange {
  milestoneId: string;
  title: string;
  origAmountUSD: string;
  origCancelAfter: string;
  newAmountUSD?: string;
  newCancelAfter?: string;
}

const HAIKU_INPUT_PER_M = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: {
        investorId: true,
        startupId: true,
        status: true,
      },
    });
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const isParty =
      contract.investorId === session.user.id ||
      contract.startupId === session.user.id;
    if (!isParty) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cp = await prisma.counterProposal.findUnique({
      where: { contractId: id },
    });

    if (!cp) {
      return NextResponse.json({ counterProposal: null });
    }

    return NextResponse.json({
      counterProposal: {
        id: cp.id,
        status: cp.status,
        milestoneChanges: cp.milestoneChanges,
        rationale: cp.rationale,
        aiImprovedRationale: cp.aiImprovedRationale,
        respondedAt: cp.respondedAt?.toISOString() ?? null,
        createdAt: cp.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[counter-proposal GET] Error:", err);
    return NextResponse.json({ error: "Failed to fetch counter-proposal" }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "STARTUP") {
      return NextResponse.json({ error: "Only receivers can submit counter-proposals" }, { status: 403 });
    }

    if (!session.user.walletAddress) {
      return NextResponse.json(
        { error: "Connect your EVM wallet before submitting a counter-proposal" },
        { status: 422 }
      );
    }

    // Rate limit: 10 counter-proposals per user per hour
    if (!(await checkRateLimit(`counter-proposal:${session.user.id}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      milestoneChanges,
      rationale,
      improveWithAi = false,
    } = body as {
      milestoneChanges?: unknown;
      rationale?: string;
      improveWithAi?: boolean;
    };

    if (!Array.isArray(milestoneChanges) || milestoneChanges.length === 0) {
      return NextResponse.json(
        { error: "milestoneChanges must be a non-empty array" },
        { status: 400 }
      );
    }

    if (typeof rationale !== "string" || rationale.trim().length < 50) {
      return NextResponse.json(
        { error: "rationale must be at least 50 characters" },
        { status: 400 }
      );
    }

    // Validate at least one milestone has a proposed change
    const hasAnyChange = (milestoneChanges as MilestoneChange[]).some(
      (mc) => mc.newAmountUSD !== undefined || mc.newCancelAfter !== undefined
    );
    if (!hasAnyChange) {
      return NextResponse.json(
        { error: "At least one milestone must have a proposed change" },
        { status: 400 }
      );
    }

    // Load contract with investor info
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        investor: { select: { id: true, email: true, name: true, companyName: true } },
        startup: { select: { id: true } },
        milestones: { select: { id: true, title: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.investorId === session.user.id) {
      return NextResponse.json({ error: "You cannot submit a counter-proposal on your own contract" }, { status: 403 });
    }

    if (contract.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Counter-proposals can only be submitted while the contract is in DRAFT status" },
        { status: 409 }
      );
    }

    // Check no existing PENDING counter-proposal
    const existing = await prisma.counterProposal.findUnique({
      where: { contractId: id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A counter-proposal has already been submitted for this contract" },
        { status: 409 }
      );
    }

    // Validate all milestoneIds belong to this contract
    const contractMilestoneIds = new Set(contract.milestones.map((m) => m.id));
    for (const mc of milestoneChanges as MilestoneChange[]) {
      if (!contractMilestoneIds.has(mc.milestoneId)) {
        return NextResponse.json(
          { error: `Milestone ${mc.milestoneId} does not belong to this contract` },
          { status: 400 }
        );
      }
    }

    // Optionally improve rationale with AI
    let aiImprovedRationale: string | null = null;
    if (improveWithAi && process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = getAnthropic();
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: `You are a professional contract negotiation assistant. Improve the following rationale for requesting milestone changes.
Make it clearer, more specific, and professional. Keep the startup's core argument intact.
Do not add claims that weren't in the original. Max 150 words.
Respond with ONLY the improved rationale as plain text. No preamble, no quotes, no markdown.`,
          messages: [
            {
              role: "user",
              content: rationale.slice(0, 800),
            },
          ],
        });
        const improved = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : null;
        if (improved && improved.length > 20) {
          aiImprovedRationale = improved;
        }
        // Track usage (non-blocking)
        const inputTokens = msg.usage?.input_tokens ?? 0;
        const outputTokens = msg.usage?.output_tokens ?? 0;
        prisma.apiUsage.create({
          data: {
            model: "claude-haiku-4-5-20251001",
            inputTokens,
            outputTokens,
            estimatedCostUsd:
              (inputTokens / 1_000_000) * HAIKU_INPUT_PER_M +
              (outputTokens / 1_000_000) * HAIKU_OUTPUT_PER_M,
            context: "counter-proposal",
          },
        }).catch(() => {});
      } catch (aiErr) {
        console.error("[counter-proposal] AI improvement failed:", aiErr);
        // Non-fatal — proceed without AI improvement
      }
    }

    // Create the counter-proposal
    const cp = await prisma.counterProposal.create({
      data: {
        contractId: id,
        proposedBy: session.user.id,
        status: "PENDING",
        milestoneChanges: milestoneChanges as object[],
        rationale: rationale.trim(),
        aiImprovedRationale,
      },
    });

    // Notify investor (non-blocking)
    sendCounterProposalSubmittedEmail({
      to: contract.investor.email,
      contractId: id,
      contractTitle: contract.milestone,
      startupName: session.user.name ?? null,
      rationale: aiImprovedRationale ?? rationale,
    }).catch(() => {});

    return NextResponse.json({
      counterProposal: {
        id: cp.id,
        status: cp.status,
        milestoneChanges: cp.milestoneChanges,
        rationale: cp.rationale,
        aiImprovedRationale: cp.aiImprovedRationale,
        createdAt: cp.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[counter-proposal POST] Error:", err);
    return NextResponse.json({ error: "Failed to submit counter-proposal" }, { status: 500 });
  }
}
