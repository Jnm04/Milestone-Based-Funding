import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyMilestone, verifyMilestoneImage, mockVerifyMilestone, categorizeFile, VERIFICATION_PROMPT_HASH, isInsufficientModels, generateRejectionObjections, runFraudPreScreen, buildFraudContext } from "@/services/ai/verifier.service";
import { storeBrainData } from "@/services/brain/training.service";
import { buildEnrichmentContext } from "@/services/brain/proof-enrichment.service";
import { releaseMilestone } from "@/services/evm/escrow.service";
import { decryptFulfillment } from "@/lib/crypto";
import { sendPendingReviewEmail, sendRejectedEmail, sendVerifiedEmail, sendMilestoneCompletedInvestorEmail, sendFulfillmentKeyEmail } from "@/lib/email";
import { contractIdToBytes32 } from "@/services/evm/escrow.service";
import { writeAuditLog } from "@/services/evm/audit.service";
import { fireWebhook } from "@/services/webhook/webhook.service";
import { createNotification } from "@/services/notifications/inapp.service";
import { getPostHogClient } from "@/lib/posthog-server";
import { isValidCronSecret } from "@/lib/cron-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { mintCompletionNFT } from "@/services/xrpl/nft.service";
import { writeAuditLog as writeAuditLogNft } from "@/services/evm/audit.service";
import crypto from "crypto";

function generatePublicProofHash(contractId: string, milestoneId: string, verifiedAt: Date): string {
  return crypto
    .createHash("sha256")
    .update(`${contractId}:${milestoneId}:${verifiedAt.toISOString()}`)
    .digest("hex");
}

async function autoMintNft(params: {
  contractId: string;
  milestoneId?: string;
  milestoneTitle: string;
  amountUSD: string;
  evmTxHash?: string;
}): Promise<void> {
  const { contractId, milestoneId, milestoneTitle, amountUSD, evmTxHash } = params;

  // Optimistic lock — only one concurrent caller wins
  const claimed = milestoneId
    ? await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: null }, data: { nftTokenId: "PENDING" } })
    : await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: null }, data: { nftTokenId: "PENDING" } });

  if (claimed.count === 0) return; // already minting or minted

  try {
    const nft = await mintCompletionNFT({ contractId, milestoneTitle, amountUSD, completedAt: new Date(), evmTxHash });
    if (milestoneId) {
      await prisma.milestone.update({ where: { id: milestoneId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash ?? null, nftImageUrl: nft.imageUrl ?? null } });
    } else {
      await prisma.contract.update({ where: { id: contractId }, data: { nftTokenId: nft.tokenId, nftTxHash: nft.txHash ?? null, nftImageUrl: nft.imageUrl ?? null } });
    }
    await writeAuditLogNft({ contractId, milestoneId, event: "NFT_MINTED", metadata: { tokenId: nft.tokenId, txHash: nft.txHash, auto: true } });
  } catch (err) {
    // Release lock on failure so manual mint button still works
    if (milestoneId) {
      await prisma.milestone.updateMany({ where: { id: milestoneId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    } else {
      await prisma.contract.updateMany({ where: { id: contractId, nftTokenId: "PENDING" }, data: { nftTokenId: null } }).catch(() => {});
    }
    throw err;
  }
}

// 150s: up to 3 AI attempts (10s + 60s waits) + XRPL/NFT overhead
export const maxDuration = 150;

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * DB-backed rate limit for verification requests.
 * H2: counts proofs that have already been verified (aiDecision set) in the last
 * 10 minutes — not proof submissions — so submitting N proofs and verifying all
 * of them is correctly throttled.
 * Safe for serverless multi-instance deployments (no in-memory state).
 */
async function checkVerifyRateLimit(userId: string): Promise<boolean> {
  const recentCount = await prisma.proof.count({
    where: {
      aiDecision: { not: null },
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      contract: {
        OR: [{ investorId: userId }, { startupId: userId }],
      },
    },
  });
  return recentCount < RATE_LIMIT_MAX;
}

// Retry delays for insufficient-model responses: wait 10s then 60s before final attempt
const RETRY_DELAYS_MS = [10_000, 60_000];
// M6: hard per-attempt timeout — if AI providers don't respond, escalate to human review
const VERIFY_TIMEOUT_MS = 45_000;

/** Races a promise against a timeout; returns null if the timeout fires first. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function POST(request: NextRequest) {
  // ── Phase 1: Auth + validation (sync, returns JSON errors before streaming) ──
  const isInternalCall = isValidCronSecret(request.headers.get("authorization"));
  let sessionUserId: string | null = null;
  if (isInternalCall) {
    // Cron calls skip per-user rate limiting but have their own global cap to
    // prevent AI cost exhaustion if CRON_SECRET is ever compromised.
    const withinCronLimit = await checkRateLimit("verify-cron:global", 200, RATE_LIMIT_WINDOW_MS);
    if (!withinCronLimit) {
      return NextResponse.json(
        { error: "Cron verification rate limit exceeded.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }
  } else {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const withinLimit = await checkVerifyRateLimit(session.user.id);
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many verification requests. Please wait 10 minutes.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }
    sessionUserId = session.user.id;
  }

  let body: { proofId?: string };
  try { body = await request.json(); } catch { body = {}; }
  const { proofId } = body;

  if (!proofId) {
    return NextResponse.json({ error: "proofId is required" }, { status: 400 });
  }

  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: {
      contract: { include: { investor: true, startup: true, milestones: { orderBy: { order: "asc" } } } },
      milestone: true,
    },
  });

  if (!proof) {
    return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  }

  // Demo contracts must use /api/demo/advance — never the real AI pipeline
  if (proof.contract.isDemo) {
    return NextResponse.json({ error: "Use /api/demo/advance for demo contracts" }, { status: 403 });
  }

  if (!isInternalCall && sessionUserId) {
    if (
      proof.contract.investorId !== sessionUserId &&
      proof.contract.startupId !== sessionUserId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  const { contract } = proof;

  if (!["PROOF_SUBMITTED", "PENDING_REVIEW"].includes(contract.status)) {
    return NextResponse.json(
      { error: `Contract is in status ${contract.status}, expected PROOF_SUBMITTED or PENDING_REVIEW` },
      { status: 409 }
    );
  }

  // ── Phase 2: SSE stream — AI verification with retry logic ──────────────────
  const milestoneTitle = proof.milestone?.title ?? contract.milestone;
  const verificationCriteria = proof.milestone?.verificationCriteria ?? null;
  const extractedText = proof.extractedText ?? "";
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "sk-ant-...";
  const category = categorizeFile("", proof.fileName);

  const enrichmentContext = hasApiKey
    ? await buildEnrichmentContext({
        proofText: extractedText,
        milestoneText: milestoneTitle,
        contractCreatedAt: contract.createdAt,
      })
    : "";

  // ── Feature E: Fraud pre-screen (runs before 5-model vote, non-fatal) ────
  let fraudContext = "";
  if (hasApiKey) {
    try {
      const preScreen = await runFraudPreScreen({
        proofId: proof.id,
        fileHash: proof.fileHash,
        contractId: contract.id,
        extractedText,
        fileCategory: category,
      });
      // Persist results on the proof record (fire-and-forget)
      void prisma.proof.update({
        where: { id: proofId },
        data: {
          authenticityFlags: preScreen.flags as never,
          authenticityScore: preScreen.score,
        },
      }).catch((err) => console.warn("[fraud-prescreen] DB write failed:", err));

      fraudContext = buildFraudContext(preScreen);
    } catch (err) {
      console.warn("[fraud-prescreen] Pre-screen failed:", err instanceof Error ? err.message : err);
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch {}
      };

      try {
        // Build the reusable AI call function
        let imageBuffer: Buffer | null = null;
        let mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";

        if (hasApiKey && category === "image") {
          const imageRes = await fetch(proof.fileUrl, {
            headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
            signal: AbortSignal.timeout(15_000),
          });
          if (!imageRes.ok) {
            throw new Error(`Failed to download image from storage: ${imageRes.status} ${imageRes.statusText}`);
          }
          imageBuffer = Buffer.from(await imageRes.arrayBuffer());
          const ext = proof.fileName.slice(proof.fileName.lastIndexOf(".")).toLowerCase();
          const mimeMap: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
          };
          mimeType = mimeMap[ext] ?? "image/jpeg";
        }

        const runVerify = async () => {
          if (!hasApiKey) return mockVerifyMilestone({ milestone: milestoneTitle, extractedText });
          if (category === "image" && imageBuffer) {
            try {
              return await verifyMilestoneImage({ milestone: milestoneTitle, imageBuffer, mimeType, enrichmentContext: enrichmentContext + fraudContext });
            } catch (imgErr) {
              console.warn("[verify] Image verification failed, falling back to Claude-only:", imgErr);
              const { callClaudeImageOnly } = await import("@/services/ai/verifier.service");
              return callClaudeImageOnly({ milestone: milestoneTitle, imageBuffer, mimeType });
            }
          }
          return verifyMilestone({
            milestone: milestoneTitle,
            extractedText: extractedText || "(No text could be extracted from this document.)",
            enrichmentContext: enrichmentContext + fraudContext,
            verificationCriteria,
          });
        };

        // ── Retry loop: up to 3 attempts if AI providers are unresponsive ────
        send({ type: "attempt", n: 1, total: 3 });
        let result = await withTimeout(runVerify(), VERIFY_TIMEOUT_MS);

        for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
          if (result !== null && !isInsufficientModels(result)) break;
          const waitSeconds = RETRY_DELAYS_MS[i] / 1000;
          const attempt = i + 2;
          send({
            type: "retrying",
            n: attempt,
            total: 3,
            waitSeconds,
            message: result === null
              ? `AI providers timed out (attempt ${attempt - 1}/3). Retrying in ${waitSeconds}s…`
              : `AI providers didn't respond (attempt ${attempt - 1}/3). Retrying in ${waitSeconds}s…`,
          });
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
          send({ type: "attempt", n: attempt, total: 3 });
          result = await withTimeout(runVerify(), VERIFY_TIMEOUT_MS);
        }

        // M6: if all attempts timed out or returned insufficient models, escalate to human review
        if (result === null || isInsufficientModels(result)) {
          if (proof.milestoneId) {
            await prisma.milestone.update({ where: { id: proof.milestoneId }, data: { status: "PENDING_REVIEW" as never } });
          }
          await prisma.contract.update({ where: { id: contract.id }, data: { status: "PENDING_REVIEW" as never } });
          await writeAuditLog({
            contractId: contract.id,
            milestoneId: proof.milestoneId ?? undefined,
            event: "AI_DECISION",
            actor: "AI",
            metadata: { decision: "TIMEOUT", action: "PENDING_REVIEW", proofId, reason: "All AI attempts unresponsive or timed out" },
          });
          send({ type: "complete", decision: "PENDING", action: "PENDING_REVIEW", reasoning: "AI verification unresponsive after 3 attempts — escalated to manual review.", timedOut: true });
          return;
        }

        // ── Persist AI result ───────────────────────────────────────────────
        await prisma.proof.update({
          where: { id: proofId },
          data: {
            aiDecision: result.decision,
            aiReasoning: result.reasoning,
            aiConfidence: result.confidence,
            aiModelVotes: result.modelVotes as never,
          },
        });

        storeBrainData({
          proofId,
          milestoneText: milestoneTitle,
          proofText: extractedText,
          modelVotes: result.modelVotes,
          consensusLevel: result.consensusLevel,
          finalDecision: result.decision,
        }).catch((err) => console.error("[brain] storeBrainData failed:", err));

        // Three-tier confidence logic
        let newStatus: string;
        let action: string;

        if (result.confidence < 60) {
          newStatus = "REJECTED";
          action = "REJECTED";
        } else if (result.confidence <= 85) {
          newStatus = "PENDING_REVIEW";
          action = "PENDING_REVIEW";
        } else if (result.decision === "YES") {
          newStatus = "VERIFIED";
          action = "VERIFIED";
        } else {
          newStatus = "REJECTED";
          action = "REJECTED";
        }

        if (proof.milestoneId) {
          await prisma.milestone.update({
            where: { id: proof.milestoneId },
            data: { status: newStatus as never },
          });
        }
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: newStatus as never },
        });

        const amountUSD = (proof.milestone?.amountUSD ?? contract.amountUSD).toString();

        await writeAuditLog({
          contractId: contract.id,
          milestoneId: proof.milestoneId ?? undefined,
          event: "AI_DECISION",
          actor: "AI",
          metadata: { decision: result.decision, confidence: result.confidence, action, proofId, promptHash: VERIFICATION_PROMPT_HASH, modelVotes: result.modelVotes },
        });

        fireWebhook({
          investorId: contract.investorId,
          startupId: contract.startupId,
          event: "ai.decision",
          contractId: contract.id,
          milestoneId: proof.milestoneId ?? undefined,
          data: { decision: result.decision, confidence: result.confidence, action, milestoneTitle },
        }).catch((err) => console.error("[webhook] ai.decision failed:", err));

        const distinctId = proof.contract.startupId ?? proof.contract.investorId;
        if (action === "VERIFIED") {
          getPostHogClient().capture({
            distinctId,
            event: "milestone_verified",
            properties: {
              contract_id: contract.id,
              milestone_id: proof.milestoneId ?? null,
              ai_confidence: result.confidence,
            },
          });
        } else if (action === "REJECTED") {
          getPostHogClient().capture({
            distinctId,
            event: "milestone_rejected",
            properties: {
              contract_id: contract.id,
              milestone_id: proof.milestoneId ?? null,
              ai_confidence: result.confidence,
              proof_id: proofId,
            },
          });
        }

        // In-app notifications
        if (action === "VERIFIED" && contract.startupId) {
          createNotification(contract.startupId, "Proof approved ✓", `"${milestoneTitle}" was verified by AI — funds are being released.`, `/contract/${contract.id}`).catch(() => {});
          createNotification(contract.investorId, "Milestone completed", `"${milestoneTitle}" has been AI-verified and funds released.`, `/contract/${contract.id}`).catch(() => {});
        } else if (action === "REJECTED" && contract.startupId) {
          createNotification(contract.startupId, "Proof not approved", `"${milestoneTitle}" was rejected — you can resubmit stronger evidence.`, `/contract/${contract.id}`).catch(() => {});
        } else if (action === "PENDING_REVIEW") {
          createNotification(contract.investorId, "Manual review needed", `AI was uncertain on "${milestoneTitle}" — your decision is required.`, `/contract/${contract.id}`).catch(() => {});
        }

        if (action === "PENDING_REVIEW") {
          fireWebhook({
            investorId: contract.investorId,
            startupId: contract.startupId,
            event: "manual_review.required",
            contractId: contract.id,
            milestoneId: proof.milestoneId ?? undefined,
            data: { milestoneTitle, aiReasoning: result.reasoning },
          }).catch((err) => console.error("[webhook] manual_review.required failed:", err));

          if (contract.investor.notifyPendingReview) {
            sendPendingReviewEmail({
              to: contract.investor.email,
              contractId: contract.id,
              milestoneTitle,
              aiReasoning: result.reasoning,
              investorId: contract.investorId,
            }).catch((err) => console.error("[email] sendPendingReviewEmail failed:", err));
          }
        }

        if (action === "REJECTED") {
          fireWebhook({
            investorId: contract.investorId,
            startupId: contract.startupId,
            event: "contract.rejected",
            contractId: contract.id,
            milestoneId: proof.milestoneId ?? undefined,
            data: { milestoneTitle, aiReasoning: result.reasoning },
          }).catch((err) => console.error("[webhook] contract.rejected failed:", err));

          if (contract.startup?.notifyRejected) {
            sendRejectedEmail({
              to: contract.startup.email,
              contractId: contract.id,
              milestoneTitle,
              aiReasoning: result.reasoning,
              startupId: contract.startupId ?? undefined,
            }).catch((err) => console.error("[email] sendRejectedEmail failed:", err));
          }

          // Generate structured objections for the Appeal Wizard — best-effort, non-fatal
          if (hasApiKey) {
            generateRejectionObjections({
              milestone: milestoneTitle,
              extractedText,
              aiReasoning: result.reasoning,
            })
              .then(async (objections) => {
                await prisma.proof.update({
                  where: { id: proofId },
                  data: { aiObjections: objections as never },
                });
                // Adaptive loop: nudge startup with targeted fix list
                if (contract.startup && objections.length > 0) {
                  const { nudgeStartupOnRejection } = await import("@/services/ai/adaptive-loop.service");
                  void nudgeStartupOnRejection({
                    proofId,
                    contractId: contract.id,
                    milestoneId: proof.milestoneId ?? undefined,
                    milestoneTitle,
                    startupEmail: contract.startup.email,
                    startupId: contract.startupId ?? "",
                    objections,
                  });
                }
              })
              .catch((err) => console.warn("[verify] Failed to generate objections:", err));
          }
        }

        // ── Auto-release when AI approves with high confidence ───────────────
        if (action === "VERIFIED") {
          try {
            const milestoneOrder = proof.milestone?.order ?? 0;
            const rawFulfillment = proof.milestone?.escrowFulfillment ?? contract.escrowFulfillment;
            if (!rawFulfillment) throw new Error("Fulfillment key not found — cannot release escrow");
            const fulfillment = decryptFulfillment(rawFulfillment);

            if (contract.startup?.email) {
              sendFulfillmentKeyEmail({
                to: contract.startup.email,
                contractId: contract.id,
                milestoneTitle,
                fulfillment,
                contractIdHash: contractIdToBytes32(contract.id),
                milestoneOrder,
              }).catch((err) => console.error("[email] sendFulfillmentKeyEmail failed:", err));
            }

            const txHash = await releaseMilestone(contract.id, milestoneOrder, fulfillment);
            console.log("[verify] Auto-released on-chain:", txHash);

            if (proof.milestoneId) {
              const completedMilestone = await prisma.milestone.update({
                where: { id: proof.milestoneId },
                data: { status: "COMPLETED", evmTxHash: txHash, escrowFulfillment: null },
                include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
              });
              const milestones = completedMilestone.contract.milestones;
              const remaining = milestones.find(
                (m) => m.id !== proof.milestoneId && !["COMPLETED", "EXPIRED"].includes(m.status)
              );
              const nextStatus = !remaining ? "COMPLETED" : remaining.status === "FUNDED" ? "FUNDED" : "AWAITING_ESCROW";
              await prisma.contract.update({ where: { id: contract.id }, data: { status: nextStatus as never } });
            } else {
              await prisma.contract.update({ where: { id: contract.id }, data: { status: "COMPLETED", escrowFulfillment: null } });
            }

            await writeAuditLog({
              contractId: contract.id,
              milestoneId: proof.milestoneId ?? undefined,
              event: "FUNDS_RELEASED",
              metadata: { txHash, amountUSD, auto: true },
            });

            fireWebhook({
              investorId: contract.investorId,
              startupId: contract.startupId,
              event: "funds.released",
              contractId: contract.id,
              milestoneId: proof.milestoneId ?? undefined,
              data: { txHash, amountUSD, milestoneTitle, auto: true },
            }).catch((err) => console.error("[webhook] funds.released failed:", err));

            if (contract.startup?.notifyVerified) {
              sendVerifiedEmail({ to: contract.startup.email, contractId: contract.id, milestoneTitle, amountUSD, txHash, startupId: contract.startupId ?? undefined })
                .catch((err) => console.error("[email] sendVerifiedEmail failed:", err));
            }
            if (contract.investor.notifyMilestoneCompleted) {
              sendMilestoneCompletedInvestorEmail({ to: contract.investor.email, contractId: contract.id, milestoneTitle, amountUSD, investorId: contract.investorId })
                .catch((err) => console.error("[email] sendMilestoneCompletedInvestorEmail failed:", err));
            }

            // Generate public proof page hash for Enterprise + opt-in Escrow
            if (proof.milestoneId && (contract.mode === "ATTESTATION" || contract.mode === "ESCROW")) {
              const proofHash = generatePublicProofHash(contract.id, proof.milestoneId, new Date());
              const baseUrl = process.env.NEXTAUTH_URL ?? "https://cascrow.com";
              void prisma.milestone.update({
                where: { id: proof.milestoneId },
                data: { publicProofHash: proofHash, publicProofGeneratedAt: new Date() },
              }).then(async () => {
                const publicUrl = `${baseUrl}/proof/${proofHash}`;
                if (contract.startup?.email) {
                  const { sendPublicProofReadyEmail } = await import("@/lib/email");
                  void sendPublicProofReadyEmail({
                    toInvestor: contract.investor.email,
                    toStartup: contract.startup.email,
                    contractId: contract.id,
                    milestoneTitle,
                    publicUrl,
                  }).catch(() => {});
                }
              }).catch(() => {});
            }

            // Auto-mint NFT certificate after successful fund release
            void autoMintNft({
              contractId: contract.id,
              milestoneId: proof.milestoneId ?? undefined,
              milestoneTitle,
              amountUSD,
              evmTxHash: txHash,
            }).catch((err) => console.warn("[auto-nft] mint failed (non-fatal):", err));

            send({ type: "complete", decision: result.decision, reasoning: result.reasoning, confidence: result.confidence, action: "COMPLETED", txHash });
            return;
          } catch (releaseErr) {
            const errMsg = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);

            // Attestation mode: no escrow — mark COMPLETED directly without escrow release
            if (contract.mode === "ATTESTATION") {
              try {
                if (proof.milestoneId) {
                  const completedMs = await prisma.milestone.update({
                    where: { id: proof.milestoneId },
                    data: { status: "COMPLETED" },
                    include: { contract: { include: { milestones: { orderBy: { order: "asc" } } } } },
                  });
                  const remaining = completedMs.contract.milestones.find(
                    (m) => m.id !== proof.milestoneId && !["COMPLETED", "EXPIRED"].includes(m.status)
                  );
                  await prisma.contract.update({
                    where: { id: contract.id },
                    data: { status: remaining ? "FUNDED" : "COMPLETED" },
                  });
                } else {
                  await prisma.contract.update({ where: { id: contract.id }, data: { status: "COMPLETED" } });
                }
                action = "COMPLETED";
              } catch (attestErr) {
                console.error("[verify] Attestation auto-complete failed:", attestErr);
              }
              return;
            }

            console.error("[verify] Auto-release failed:", errMsg);
            writeAuditLog({
              contractId: contract.id,
              milestoneId: proof.milestoneId ?? undefined,
              event: "FUNDS_RELEASED",
              actor: "SYSTEM",
              metadata: { error: errMsg, auto: true, failed: true },
            }).catch((e) => console.error("[audit] Failed to write release-failure log:", e));
          }
        }

        send({ type: "complete", decision: result.decision, reasoning: result.reasoning, confidence: result.confidence, action });
      } catch (err) {
        console.error("Verification error:", err);
        send({ type: "error", message: "Verification failed", code: "VERIFICATION_FAILED" });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
