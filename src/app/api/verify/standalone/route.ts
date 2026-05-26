/**
 * POST /api/verify/standalone
 * ===========================
 * Verify AI-generated work without an escrow contract.
 * Accepts a task description + GitHub PR URL or pasted code.
 * Runs the same 5-model AI panel as escrow verification.
 *
 * Auth tiers:
 *  - Anonymous (no session, no API key): 3 free verifications per IP per 24h
 *  - Authenticated (session or API key): uses verificationCredits; first 3 free
 *
 * Rate limits:
 *  - Anonymous: standalone-verify-anon:{ip}  — 3 / 24h
 *  - Authenticated: standalone-verify-auth:{userId} — 10 / 1h
 *
 * No contract, no milestone, no escrow release, no NFT mint.
 * Creates a StandaloneVerification record with a public hash for the report page.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { getMobileSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  verifyStandaloneWork,
  ChecklistItem,
} from "@/services/ai/verifier.service";
import {
  parseGitHubUrl,
  fetchGitHubPrProof,
  fetchGitHubProof,
} from "@/services/github/github.service";

export const maxDuration = 120;

const FREE_TIER_LIMIT = 3;

const bodySchema = z.object({
  taskDescription: z.string().min(10).max(2000),
  prUrl: z
    .string()
    .url()
    .optional()
    .refine(
      (url) => {
        if (!url) return true;
        try {
          const { hostname } = new URL(url);
          return hostname === "github.com";
        } catch {
          return false;
        }
      },
      { message: "Only github.com URLs are supported" }
    ),
  codeText: z.string().max(50_000).optional(),
  checklistItems: z
    .array(
      z.object({
        id: z.number().int().min(1).max(100),
        title: z.string().min(1).max(200),
        severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
      })
    )
    .max(20)
    .optional(),
});

export async function POST(request: NextRequest) {
  // ── Auth (optional) ───────────────────────────────────────────────────────────
  const session = await getMobileSession(request);
  const userId = session?.user?.id ?? null;
  const ip = getClientIp(request) ?? "unknown";

  // ── Rate limiting ─────────────────────────────────────────────────────────────
  if (userId) {
    if (!(await checkRateLimit(`standalone-verify-auth:${userId}`, 10, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many verification requests. Try again in an hour." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }
  } else {
    if (!(await checkRateLimit(`standalone-verify-anon:${ip}`, 3, 24 * 60 * 60 * 1000))) {
      return NextResponse.json(
        {
          error: "Free tier limit reached (3/day). Create a free account for more verifications.",
          requiresAccount: true,
        },
        { status: 429, headers: { "Retry-After": "86400" } }
      );
    }
  }

  // ── Parse + validate input ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { taskDescription, prUrl, codeText, checklistItems } = parsed.data;

  if (!prUrl && !codeText) {
    return NextResponse.json(
      { error: "Provide either a GitHub PR URL or paste code text." },
      { status: 400 }
    );
  }

  // ── Credit check for authenticated users ─────────────────────────────────────
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verificationCredits: true, freeVerificationsUsed: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hasFreeVerification = user.freeVerificationsUsed < FREE_TIER_LIMIT;
    const hasPaidCredit = user.verificationCredits > 0;

    if (!hasFreeVerification && !hasPaidCredit) {
      return NextResponse.json(
        {
          error: "No verification credits remaining.",
          freeUsed: user.freeVerificationsUsed,
          paidCredits: user.verificationCredits,
          requiresCredits: true,
        },
        { status: 402 }
      );
    }

    // Atomic deduct: prefer free tier first, then paid credits
    if (hasFreeVerification) {
      await prisma.user.update({
        where: { id: userId },
        data: { freeVerificationsUsed: { increment: 1 } },
      });
    } else {
      // Atomic check-and-decrement to prevent race conditions
      const updated = await prisma.user.updateMany({
        where: { id: userId, verificationCredits: { gte: 1 } },
        data: { verificationCredits: { decrement: 1 } },
      });
      if (updated.count === 0) {
        return NextResponse.json({ error: "No credits available." }, { status: 402 });
      }
    }
  }

  // ── Fetch proof content ───────────────────────────────────────────────────────
  let extractedText = codeText ?? "";
  let resolvedPrUrl: string | null = null;

  if (prUrl) {
    const parsedUrl = parseGitHubUrl(prUrl);
    if (!parsedUrl) {
      return NextResponse.json({ error: "Invalid GitHub URL." }, { status: 400 });
    }

    if (parsedUrl.pullNumber) {
      // PR URL — fetch diff
      const prDoc = await fetchGitHubPrProof(prUrl);
      if (!prDoc) {
        return NextResponse.json(
          {
            error:
              "Could not access this GitHub PR. Make sure the PR is public and the URL is correct (e.g. github.com/owner/repo/pull/123).",
          },
          { status: 422 }
        );
      }
      extractedText = prDoc.text + (codeText ? `\n\n[ADDITIONAL CONTEXT]\n${codeText}` : "");
      resolvedPrUrl = prDoc.prUrl;
    } else {
      // Repo URL — fetch repo metadata (existing behaviour)
      const repoDoc = await fetchGitHubProof(prUrl);
      if (!repoDoc) {
        return NextResponse.json(
          { error: "Could not access this GitHub repository. Make sure it is public." },
          { status: 422 }
        );
      }
      extractedText = repoDoc.text + (codeText ? `\n\n[ADDITIONAL CONTEXT]\n${codeText}` : "");
    }
  }

  if (!extractedText.trim()) {
    return NextResponse.json({ error: "No content to verify." }, { status: 400 });
  }

  // ── Generate public hash (deterministic, pre-creation) ────────────────────────
  const publicHash = crypto
    .createHash("sha256")
    .update(`standalone:${userId ?? ip}:${Date.now()}:${taskDescription.slice(0, 50)}`)
    .digest("hex");

  // ── Create pending record ─────────────────────────────────────────────────────
  const record = await prisma.standaloneVerification.create({
    data: {
      userId,
      taskDescription,
      prUrl: resolvedPrUrl ?? prUrl ?? null,
      codeText: codeText ?? null,
      checklistItems: checklistItems ? (checklistItems as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      publicHash,
      status: "PENDING",
      usedCredit: userId
        ? (
            await prisma.user
              .findUnique({ where: { id: userId }, select: { freeVerificationsUsed: true } })
              .then((u) => (u ? u.freeVerificationsUsed > FREE_TIER_LIMIT : false))
          )
        : false,
    },
  });

  // ── Run verification ──────────────────────────────────────────────────────────
  try {
    const result = await verifyStandaloneWork({
      taskDescription,
      extractedText,
      checklistItems: checklistItems as ChecklistItem[] | undefined,
    });

    // Persist result
    await prisma.standaloneVerification.update({
      where: { id: record.id },
      data: {
        decision: result.decision,
        confidence: result.confidence,
        result: {
          decision: result.decision,
          confidence: result.confidence,
          reasoning: result.reasoning,
          modelVotes: result.modelVotes,
          consensusLevel: result.consensusLevel,
          checklistResults: result.checklistResults ?? null,
        } as unknown as Prisma.InputJsonValue,
        status: "COMPLETED",
      },
    });

    const reportUrl = `${process.env.NEXTAUTH_URL ?? "https://cascrow.com"}/verify/result/${publicHash}`;

    return NextResponse.json({
      id: record.id,
      publicHash,
      reportUrl,
      decision: result.decision,
      confidence: result.confidence,
      reasoning: result.reasoning,
      modelVotes: result.modelVotes,
      consensusLevel: result.consensusLevel,
      checklistResults: result.checklistResults ?? null,
    });
  } catch (err) {
    console.error("[verify/standalone] Verification failed:", err);
    await prisma.standaloneVerification.update({
      where: { id: record.id },
      data: { status: "FAILED" },
    }).catch(() => {});
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
