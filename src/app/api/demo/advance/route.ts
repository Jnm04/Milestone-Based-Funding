import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { nanoid } from "nanoid";

const VALID_STEPS = ["fund", "submit_proof", "verify", "release"] as const;
type Step = typeof VALID_STEPS[number];

function buildDemoProofText(milestoneTitle: string, contractDescription: string): string {
  return `MILESTONE COMPLETION REPORT — Acme AI Labs

MILESTONE: ${milestoneTitle}
CONTRACT: ${contractDescription}

EXECUTIVE SUMMARY
Acme AI Labs has fully completed all criteria for the milestone "${milestoneTitle}". All requirements have been met and are documented below with verifiable evidence.

KEY ACHIEVEMENTS
1. Public MVP launched at app.acme-ai.com with complete feature set (auth, payments, core AI pipeline)
2. 147 confirmed beta signups via ProductHunt launch (#4 Product of the Day) and newsletter campaign
3. 4 integration partner agreements signed:
   - Stripe (payments processing) — live integration
   - Auth0 (identity management) — live integration
   - Twilio (SMS notifications) — signed LOI
   - Sendgrid (transactional email) — live integration
4. GitHub: github.com/acme-ai-labs/platform — 847 commits, 23 contributors, active since milestone start
5. First paying customers: $3,200 MRR within 2 weeks of launch

SUPPORTING EVIDENCE
- App Store / Play Store screenshots with download metrics (pages 2–4)
- Signed LOI documents for Twilio partnership (pages 5–6)
- GitHub activity report and commit history export (pages 7–9)
- ProductHunt analytics showing 147 verified signups (page 10)
- Stripe dashboard screenshot showing MRR data (page 11)

All evidence is timestamped within the milestone period and directly addresses the criteria specified in the contract.

Submitted by: Acme AI Labs
Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`demo-advance:${ip}`, 30, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { contractId?: string; step?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { contractId, step } = body;

  if (!contractId || typeof contractId !== "string") {
    return NextResponse.json({ error: "contractId is required" }, { status: 400 });
  }
  if (!step || !(VALID_STEPS as readonly string[]).includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      milestones: { orderBy: { order: "asc" } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // SECURITY: Only advance demo contracts. This check must come before any mutation.
  if (!contract.isDemo) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Active milestone = first non-COMPLETED, non-EXPIRED, non-PENDING milestone
  const activeMilestone =
    contract.milestones.find(
      (m) => !["COMPLETED", "EXPIRED", "PENDING"].includes(m.status)
    ) ?? contract.milestones[0];

  if (!activeMilestone) {
    return NextResponse.json({ error: "No active milestone found" }, { status: 409 });
  }

  // ── fund ─────────────────────────────────────────────────────────────────────
  if (step === "fund") {
    if (activeMilestone.status !== "AWAITING_ESCROW") {
      return NextResponse.json(
        { error: `Expected AWAITING_ESCROW, got ${activeMilestone.status}` },
        { status: 409 }
      );
    }

    const fakeTxHash = `0xdemo${nanoid(62)}`.slice(0, 66);

    await prisma.$transaction([
      prisma.milestone.update({
        where: { id: activeMilestone.id },
        data: { status: "FUNDED", evmTxHash: fakeTxHash },
      }),
      prisma.contract.update({
        where: { id: contractId },
        data: { status: "FUNDED", evmTxHash: fakeTxHash },
      }),
    ]);

    return NextResponse.json({ ok: true, txHash: fakeTxHash });
  }

  // ── submit_proof ──────────────────────────────────────────────────────────────
  if (step === "submit_proof") {
    if (activeMilestone.status !== "FUNDED") {
      return NextResponse.json(
        { error: `Expected FUNDED, got ${activeMilestone.status}` },
        { status: 409 }
      );
    }

    const proofText = buildDemoProofText(activeMilestone.title, contract.milestone);

    const proof = await prisma.proof.create({
      data: {
        contractId,
        milestoneId: activeMilestone.id,
        fileName: "acme-ai-labs-milestone-proof.pdf",
        fileUrl: "/demo-proof.html",
        extractedText: proofText,
        proofType: "file",
      },
    });

    await prisma.$transaction([
      prisma.milestone.update({
        where: { id: activeMilestone.id },
        data: { status: "PROOF_SUBMITTED" },
      }),
      prisma.contract.update({
        where: { id: contractId },
        data: { status: "PROOF_SUBMITTED" },
      }),
    ]);

    return NextResponse.json({ ok: true, proofId: proof.id });
  }

  // ── verify ────────────────────────────────────────────────────────────────────
  if (step === "verify") {
    if (activeMilestone.status !== "PROOF_SUBMITTED") {
      return NextResponse.json(
        { error: `Expected PROOF_SUBMITTED, got ${activeMilestone.status}` },
        { status: 409 }
      );
    }

    const proof = await prisma.proof.findFirst({
      where: { milestoneId: activeMilestone.id, aiDecision: null },
      orderBy: { createdAt: "desc" },
    });

    if (!proof) {
      return NextResponse.json({ error: "No pending proof found" }, { status: 404 });
    }

    const confidence = 94;
    const reasoning =
      "5/5 AI models unanimously approved this milestone. The submitted proof provides specific, verifiable evidence: a live public MVP with confirmed beta signups documented via ProductHunt analytics, four signed integration partnerships with Stripe, Auth0, Twilio, and Sendgrid, and an active GitHub repository with consistent commit history throughout the milestone period. All criteria are directly addressed. Confidence is high.";

    const mockVotes = [
      { model: "Claude Haiku", decision: "YES", confidence: 95, reasoning: "Clear MVP evidence with documented signups and live integrations." },
      { model: "Gemini Flash", decision: "YES", confidence: 92, reasoning: "Beta signup count verified. Integration partners confirmed via LOIs." },
      { model: "GPT-4o-mini", decision: "YES", confidence: 96, reasoning: "All milestone criteria met. GitHub activity consistent with claims." },
      { model: "Mistral Small", decision: "YES", confidence: 93, reasoning: "Sufficient evidence of MVP launch and partnership agreements." },
      { model: "Cerebras/Qwen3", decision: "YES", confidence: 94, reasoning: "Public launch confirmed. Signups and integrations documented." },
    ];

    await prisma.$transaction([
      prisma.proof.update({
        where: { id: proof.id },
        data: {
          aiDecision: "YES",
          aiConfidence: confidence,
          aiReasoning: reasoning,
          aiModelVotes: mockVotes,
          authenticityScore: 100,
          authenticityFlags: [],
        },
      }),
      prisma.milestone.update({
        where: { id: activeMilestone.id },
        data: { status: "VERIFIED" },
      }),
      prisma.contract.update({
        where: { id: contractId },
        data: { status: "VERIFIED" },
      }),
    ]);

    return NextResponse.json({ ok: true, decision: "YES", confidence, reasoning });
  }

  // ── release ───────────────────────────────────────────────────────────────────
  if (step === "release") {
    if (activeMilestone.status !== "VERIFIED") {
      return NextResponse.json(
        { error: `Expected VERIFIED, got ${activeMilestone.status}` },
        { status: 409 }
      );
    }

    const nftId = nanoid(12).toUpperCase();
    const mockNftTokenId = `DEMO-NFT-${nftId}`;
    const mockNftTxHash = `DEMO-TX-${nanoid(48).toUpperCase()}`.slice(0, 64);
    const mockEvmTxHash = `0xdemo${nanoid(62)}`.slice(0, 66);
    const mockNftImageUrl = "/demo-nft-certificate.svg";

    const remainingMilestones = contract.milestones.filter(
      (m) => m.id !== activeMilestone.id && !["COMPLETED", "EXPIRED"].includes(m.status)
    );
    const nextContractStatus =
      remainingMilestones.length === 0
        ? "COMPLETED"
        : remainingMilestones[0].status === "FUNDED"
        ? "FUNDED"
        : "AWAITING_ESCROW";

    await prisma.$transaction([
      prisma.milestone.update({
        where: { id: activeMilestone.id },
        data: {
          status: "COMPLETED",
          evmTxHash: mockEvmTxHash,
          nftTokenId: mockNftTokenId,
          nftTxHash: mockNftTxHash,
          nftImageUrl: mockNftImageUrl,
        },
      }),
      prisma.contract.update({
        where: { id: contractId },
        data: { status: nextContractStatus as never },
      }),
    ]);

    return NextResponse.json({ ok: true, nftTokenId: mockNftTokenId });
  }

  return NextResponse.json({ error: "Unknown step" }, { status: 400 });
}
