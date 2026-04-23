import { Resend } from "resend";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  tgProofSubmitted,
  tgPendingReview,
  tgMilestoneCompleted,
  tgFunded,
  tgVerified,
  tgRejected,
} from "@/services/telegram/telegram.service";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Cascrow <onboarding@resend.dev>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ── Feature M: AI-Personalized Email Copy ────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

/**
 * Generate 1–2 personalized sentences for the email body using Claude Haiku.
 * Returns null on any error or if the API key is absent — callers fall back to static copy.
 */
async function generateEmailBody(
  emailType: string,
  context: Record<string, string | number | undefined>
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const contextStr = Object.entries(context)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      system: `You write short, professional email body copy for Cascrow — a milestone-based grant escrow platform where investors fund startups by milestone.
Write exactly 1–2 sentences of personalized notification text for the given email type and context.
Use the specific names, amounts, and milestone titles provided. Be direct, warm, and action-oriented.
Respond with ONLY the sentences. No greeting, no subject line, no sign-off, no quotation marks, no HTML.`,
      messages: [
        {
          role: "user",
          content: `Email type: ${emailType}\n\nContext:\n${contextStr}`,
        },
      ],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;
    if (text) {
      void prisma.apiUsage
        .create({
          data: {
            model: "Claude Haiku",
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            estimatedCostUsd:
              (0.8 * response.usage.input_tokens + 4.0 * response.usage.output_tokens) /
              1_000_000,
            context: "email-personalization",
          },
        })
        .catch(() => {});
    }
    return text;
  } catch {
    return null;
  }
}

/** HTML-encode user-controlled strings before embedding them in email templates. */
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function contractLink(contractId: string) {
  return `${BASE_URL}/contract/${contractId}`;
}

function enterpriseLink(contractId: string) {
  return `${BASE_URL}/enterprise/dashboard/attestations/${contractId}`;
}

// ── Email verification ──────────────────────────────────────────────────────

export async function sendVerificationEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const link = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your Cascrow email address",
    html: `
      <p>Hi,</p>
      <p>Thanks for signing up for Cascrow. Please verify your email address by clicking the link below.</p>
      <p><a href="${link}">Verify email address →</a></p>
      <p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
    `,
  });
}

// ── Password reset ──────────────────────────────────────────────────────────

export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your Cascrow password",
    html: `
      <p>Hi,</p>
      <p>We received a request to reset your Cascrow password. Click the link below to set a new password.</p>
      <p><a href="${link}">Reset password →</a></p>
      <p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
    `,
  });
}

// ── Grant Giver notifications ───────────────────────────────────────────────

export async function sendProofSubmittedEmail({
  to,
  contractId,
  milestoneTitle,
  startupName,
  investorId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  startupName?: string | null;
  investorId?: string;
}) {
  // Telegram — fire-and-forget
  if (investorId) {
    void tgProofSubmitted({ investorId, contractId, milestoneTitle, startupName });
  }
  if (!process.env.RESEND_API_KEY) return;
  const aiBody = await generateEmailBody("proof-submitted-investor", {
    "startup name": startupName || "The Receiver",
    "milestone title": milestoneTitle,
  });
  const bodyText = aiBody
    ?? `<strong>${esc(startupName) || "The Receiver"}</strong> has submitted proof for the milestone <strong>${esc(milestoneTitle)}</strong>.`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof submitted: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>${aiBody ? esc(aiBody) : bodyText}</p>
      <p>AI verification runs automatically. You will be notified if a manual review is required.</p>
      <p><a href="${contractLink(contractId)}">Open contract →</a></p>
    `,
  });
}

export async function sendPendingReviewEmail({
  to,
  contractId,
  milestoneTitle,
  aiReasoning,
  investorId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
  investorId?: string;
}) {
  if (investorId) {
    void tgPendingReview({ investorId, contractId, milestoneTitle, aiReasoning });
  }
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Manual review required: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>The AI was uncertain about milestone <strong>${esc(milestoneTitle)}</strong> and needs your manual review.</p>
      ${aiReasoning ? `<p><em>AI reasoning: ${esc(aiReasoning)}</em></p>` : ""}
      <p style="background:#fff3cd;border-left:4px solid #e6a817;padding:10px 14px;margin:12px 0;font-size:13px;">
        <strong>Action required within 14 days.</strong> If no decision is made, the milestone will be automatically approved and funds released to the Receiver.
      </p>
      <p><a href="${contractLink(contractId)}">Review now →</a></p>
    `,
  });
}

export async function sendMilestoneCompletedInvestorEmail({
  to,
  contractId,
  milestoneTitle,
  amountUSD,
  investorId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  investorId?: string;
}) {
  if (investorId) {
    void tgMilestoneCompleted({ investorId, contractId, milestoneTitle, amountUSD });
  }
  if (!process.env.RESEND_API_KEY) return;
  const aiBody = await generateEmailBody("milestone-completed-investor", {
    "milestone title": milestoneTitle,
    "amount RLUSD": `$${Number(amountUSD).toLocaleString()}`,
  });
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone completed: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>${aiBody ? esc(aiBody) : `Milestone <strong>${esc(milestoneTitle)}</strong> has been successfully completed. The payment of <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been released.`}</p>
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

// ── Receiver notifications ──────────────────────────────────────────────────

export async function sendFundedEmail({
  to,
  contractId,
  milestoneTitle,
  amountUSD,
  startupId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  startupId?: string;
}) {
  if (startupId) {
    void tgFunded({ startupId, contractId, milestoneTitle, amountUSD });
  }
  if (!process.env.RESEND_API_KEY) return;
  const aiBody = await generateEmailBody("milestone-funded-startup", {
    "milestone title": milestoneTitle,
    "amount RLUSD": `$${Number(amountUSD).toLocaleString()}`,
  });
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone funded: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>${aiBody ? esc(aiBody) : `Your milestone <strong>${esc(milestoneTitle)}</strong> has been funded with <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong>.`}</p>
      <p>Upload proof once you have completed the milestone to trigger payment release.</p>
      <p><a href="${contractLink(contractId)}">Upload proof →</a></p>
    `,
  });
}

export async function sendVerifiedEmail({
  to,
  contractId,
  milestoneTitle,
  amountUSD,
  txHash,
  startupId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  txHash?: string | null;
  startupId?: string;
}) {
  if (startupId) {
    void tgVerified({ startupId, contractId, milestoneTitle, amountUSD, txHash });
  }
  if (!process.env.RESEND_API_KEY) return;
  const aiBody = await generateEmailBody("proof-verified-payment-released-startup", {
    "milestone title": milestoneTitle,
    "amount RLUSD": `$${Number(amountUSD).toLocaleString()}`,
  });
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payment released: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>${aiBody ? esc(aiBody) : `Congratulations! Your proof for <strong>${esc(milestoneTitle)}</strong> has been approved. <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been sent to your wallet.`}</p>
      ${txHash ? `<p>Transaction: <code>${txHash}</code></p>` : ""}
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

export async function sendRejectedEmail({
  to,
  contractId,
  milestoneTitle,
  aiReasoning,
  startupId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
  startupId?: string;
}) {
  if (startupId) {
    void tgRejected({ startupId, contractId, milestoneTitle, aiReasoning });
  }
  if (!process.env.RESEND_API_KEY) return;
  const aiBody = await generateEmailBody("proof-rejected-startup", {
    "milestone title": milestoneTitle,
    "rejection reason": aiReasoning ?? undefined,
  });
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof rejected: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>${aiBody ? esc(aiBody) : `Your proof for <strong>${esc(milestoneTitle)}</strong> was not accepted by the AI verification system.`}</p>
      ${!aiBody && aiReasoning ? `<p><strong>Reason:</strong> ${esc(aiReasoning)}</p>` : ""}
      <p>You can submit new proof as long as the deadline has not passed.</p>
      <p><a href="${contractLink(contractId)}">Resubmit →</a></p>
    `,
  });
}

export async function sendDeadlineReminderEmail({
  to,
  contractId,
  milestoneTitle,
  deadlineAt,
  role,
  hasProof,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  deadlineAt: Date;
  role: "investor" | "startup";
  hasProof: boolean;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const hoursLeft = Math.round((deadlineAt.getTime() - Date.now()) / (1000 * 60 * 60));
  const daysLeft = Math.round(hoursLeft / 24);
  const timeLabel = daysLeft >= 1 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : `${hoursLeft} hours`;

  const subject =
    role === "startup"
      ? `Deadline in ${timeLabel}: ${milestoneTitle}`
      : `No proof submitted yet — ${timeLabel} remaining: ${milestoneTitle}`;

  const body =
    role === "startup"
      ? `<p>Hi,</p>
         <p>Your deadline for milestone <strong>${esc(milestoneTitle)}</strong> is in <strong>${timeLabel}</strong>.</p>
         ${hasProof
           ? "<p>You have already submitted proof — AI verification is in progress or awaiting review.</p>"
           : "<p>You have not yet submitted proof. Please upload it before the deadline to receive payment.</p>"
         }
         <p><a href="${contractLink(contractId)}">Open milestone →</a></p>`
      : `<p>Hi,</p>
         <p>The startup has not yet submitted proof for milestone <strong>${esc(milestoneTitle)}</strong>.</p>
         <p>The deadline is in <strong>${timeLabel}</strong>. If no proof is submitted, the escrow will be automatically returned to you.</p>
         <p><a href="${contractLink(contractId)}">View contract →</a></p>`;

  await resend.emails.send({ from: FROM, to, subject, html: body });
}

export async function sendManualApprovedEmail({
  to,
  contractId,
  milestoneTitle,
  amountUSD,
  startupId,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  startupId?: string;
}) {
  if (startupId) {
    void tgVerified({ startupId, contractId, milestoneTitle, amountUSD, txHash: null });
  }
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Approved — release your funds: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Great news! The Grant Giver has manually approved your proof for <strong>${esc(milestoneTitle)}</strong>.</p>
      <p><strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> is ready to be released to your wallet.</p>
      <p>Open the contract page and click <strong>Release Funds</strong> to receive your payment.</p>
      <p><a href="${contractLink(contractId)}">Release funds →</a></p>
    `,
  });
}

export async function sendFulfillmentKeyEmail({
  to,
  contractId,
  milestoneTitle,
  fulfillment,
  contractIdHash,
  milestoneOrder,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  fulfillment: string;
  contractIdHash: string;
  milestoneOrder: number;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const escrowAddress = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Escrow release key: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Your milestone <strong>${esc(milestoneTitle)}</strong> has been approved. Payment is being automatically released to your wallet.</p>
      <p>As a trustless backup, here is your <strong>escrow release key</strong>. If the automatic payment does not arrive, you can release the funds yourself directly on-chain — no platform involvement needed.</p>
      <hr />
      <p><strong>Escrow Contract:</strong> <code>${escrowAddress}</code></p>
      <p><strong>Contract ID (bytes32):</strong> <code>${contractIdHash}</code></p>
      <p><strong>Milestone Order:</strong> <code>${milestoneOrder}</code></p>
      <p><strong>Fulfillment Key:</strong> <code>${fulfillment}</code></p>
      <hr />
      <p>To release manually, call <code>releaseMilestone(contractId, milestoneOrder, fulfillment)</code> on the escrow contract above using any EVM wallet (e.g. MetaMask).</p>
      <p><strong>Keep this key secure.</strong> Anyone who has it can trigger the release.</p>
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

// ── Feature F: Renegotiation notifications ────────────────────────────────────

export async function sendRenegotiationOpenedEmail({
  toInvestor,
  toStartup,
  contractId,
  milestoneTitle,
  deadlineHours,
}: {
  toInvestor: string;
  toStartup: string;
  contractId: string;
  milestoneTitle: string;
  deadlineHours: number;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const link = contractLink(contractId);
  await Promise.allSettled([
    resend.emails.send({
      from: FROM,
      to: toInvestor,
      subject: `Renegotiation window open: ${milestoneTitle}`,
      html: `
        <p>Hi,</p>
        <p>The deadline for milestone <strong>${esc(milestoneTitle)}</strong> has passed without a submitted proof.</p>
        <p>A <strong>${deadlineHours}-hour renegotiation window</strong> is now open. The Receiver can submit a progress update to request an extension — you will be notified when they do.</p>
        <p>If no request is submitted within ${deadlineHours} hours, the escrow will be automatically cancelled and RLUSD returned to you.</p>
        <p><a href="${link}">View contract →</a></p>
      `,
    }),
    resend.emails.send({
      from: FROM,
      to: toStartup,
      subject: `Extension request window open: ${milestoneTitle}`,
      html: `
        <p>Hi,</p>
        <p>The deadline for milestone <strong>${esc(milestoneTitle)}</strong> has passed.</p>
        <p>You have <strong>${deadlineHours} hours</strong> to submit a progress update and request a deadline extension. The Grant Giver will review your request and decide whether to approve it.</p>
        <p>If no request is submitted in time, the escrow will be automatically cancelled.</p>
        <p><a href="${link}">Submit progress update →</a></p>
      `,
    }),
  ]);
}

export async function sendExtensionRequestedEmail({
  to,
  contractId,
  milestoneTitle,
  extensionDays,
  startupName,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  extensionDays: number;
  startupName?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Extension request: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(startupName) || "The Receiver"}</strong> has submitted a progress update and is requesting a <strong>${extensionDays}-day extension</strong> for milestone <strong>${esc(milestoneTitle)}</strong>.</p>
      <p>Open the contract to review the update and AI plausibility assessment, then approve or reject.</p>
      <p><a href="${contractLink(contractId)}">Review extension request →</a></p>
    `,
  });
}

export async function sendExtensionApprovedEmail({
  to,
  contractId,
  milestoneTitle,
  extensionDays,
  newDeadline,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  extensionDays: number;
  newDeadline: Date;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Extension approved: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>The Grant Giver has approved your extension request for <strong>${esc(milestoneTitle)}</strong>.</p>
      <p>You now have <strong>${extensionDays} additional days</strong>. New deadline: <strong>${newDeadline.toLocaleDateString()}</strong>.</p>
      <p>Upload your proof before the new deadline to receive payment.</p>
      <p><a href="${contractLink(contractId)}">Open milestone →</a></p>
    `,
  });
}

export async function sendExtensionRejectedEmail({
  to,
  contractId,
  milestoneTitle,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Extension rejected: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>The Grant Giver has rejected your extension request for <strong>${esc(milestoneTitle)}</strong>.</p>
      <p>The escrow has been cancelled and funds returned to the Grant Giver.</p>
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

// ── Feature G: Progress Check-ins ────────────────────────────────────────────

/** Weekly nudge sent to the startup for a FUNDED milestone. */
export async function sendProgressCheckinEmail({
  to,
  contractId,
  milestoneTitle,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Weekly check-in: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Quick check-in for milestone <strong>${esc(milestoneTitle)}</strong> — how's it going?</p>
      <p>Share a short progress update on the contract page so the Grant Giver knows where things stand.</p>
      <p><a href="${contractLink(contractId)}">Log a progress update →</a></p>
    `,
  });
}

/** Notify investor when the startup has logged a progress update. */
export async function sendProgressUpdateNotifiedEmail({
  to,
  contractId,
  milestoneTitle,
  updateText,
  startupName,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  updateText: string;
  startupName?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Progress update: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(startupName) || "The Receiver"}</strong> has shared a progress update for milestone <strong>${esc(milestoneTitle)}</strong>:</p>
      <blockquote style="border-left:3px solid #C4704B;margin:12px 0;padding:8px 14px;color:#555;">${esc(updateText.slice(0, 500))}${updateText.length > 500 ? "…" : ""}</blockquote>
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

// ── Feature Z: Contract Counter-Proposal ────────────────────────────────────

/** Notify the investor that a startup has submitted a counter-proposal. */
export async function sendCounterProposalSubmittedEmail({
  to,
  contractId,
  contractTitle,
  startupName,
  rationale,
}: {
  to: string;
  contractId: string;
  contractTitle: string;
  startupName?: string | null;
  rationale: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Counter-proposal received: ${contractTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(startupName) || "A Receiver"}</strong> has submitted a counter-proposal for your contract <strong>${esc(contractTitle)}</strong>.</p>
      <p>They have proposed changes to the milestone terms and provided this rationale:</p>
      <blockquote style="border-left:3px solid #C4704B;margin:12px 0;padding:8px 14px;color:#555;">${esc(rationale.slice(0, 600))}${rationale.length > 600 ? "…" : ""}</blockquote>
      <p>Open the contract to review the proposed changes and accept or reject them.</p>
      <p><a href="${contractLink(contractId)}">Review counter-proposal →</a></p>
    `,
  });
}

/** Notify the startup that the investor responded to their counter-proposal. */
export async function sendCounterProposalRespondedEmail({
  to,
  contractId,
  contractTitle,
  decision,
  investorName,
}: {
  to: string;
  contractId: string;
  contractTitle: string;
  decision: "ACCEPTED" | "REJECTED";
  investorName?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const accepted = decision === "ACCEPTED";
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Counter-proposal ${accepted ? "accepted" : "rejected"}: ${contractTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(investorName) || "The Grant Giver"}</strong> has <strong>${accepted ? "accepted" : "rejected"}</strong> your counter-proposal for <strong>${esc(contractTitle)}</strong>.</p>
      ${accepted
        ? `<p>Your proposed terms have been applied. The contract is now awaiting escrow funding — the Grant Giver will lock RLUSD shortly.</p>`
        : `<p>Your proposed changes were not accepted. The original terms remain in place — you can still accept the original invitation or decline it.</p>`
      }
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

/** Notify auditor (and optionally owner) of an attestation run result. */
export async function sendAttestationResultEmail({
  to,
  milestoneTitle,
  period,
  verdict,
  reasoning,
  certUrl,
  xrplTxHash,
  contractId,
}: {
  to: string;
  milestoneTitle: string;
  period: string;
  verdict: "YES" | "NO" | "INCONCLUSIVE";
  reasoning: string;
  certUrl: string | null;
  xrplTxHash: string | null;
  contractId: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const verdictLabel = verdict === "YES" ? "✅ VERIFIED" : verdict === "NO" ? "❌ NOT MET" : "⚠️ INCONCLUSIVE";
  const isTestnet = process.env.XRPL_NETWORK === "testnet";
  const xrplExplorer = isTestnet ? "testnet.xrpscan.com" : "xrpscan.com";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Attestation result: ${milestoneTitle} — ${verdict}`,
    html: `
      <p>An attestation run has completed for the following milestone:</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Milestone</td><td style="padding:6px 0;font-weight:bold">${esc(milestoneTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Period</td><td style="padding:6px 0">${esc(period)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Verdict</td><td style="padding:6px 0;font-weight:bold">${verdictLabel}</td></tr>
      </table>
      <p style="background:#f7f7f7;padding:12px;border-left:3px solid #C4704B;font-style:italic">${esc(reasoning)}</p>
      ${xrplTxHash ? `<p style="font-size:12px;color:#666">On-chain record: <a href="https://${xrplExplorer}/transactions/${xrplTxHash}">${xrplTxHash.slice(0, 20)}…</a></p>` : ""}
      ${certUrl ? `<p><a href="${certUrl}">View attestation certificate →</a></p>` : ""}
      <p><a href="${contractLink(contractId)}">View contract →</a></p>
    `,
  });
}

// ── Enterprise Early Warning ──────────────────────────────────────────────────

export async function sendEarlyWarningEmail({
  to,
  milestoneTitle,
  contractId,
  risk,
  aiAssessment,
  period,
}: {
  to: string;
  milestoneTitle: string;
  contractId: string;
  risk: "AT_RISK" | "LIKELY_MISS";
  aiAssessment: string;
  period: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const riskLabel = risk === "LIKELY_MISS" ? "⚠️ Likely to miss target" : "⚠️ At risk of missing target";
  const riskColor = risk === "LIKELY_MISS" ? "#DC2626" : "#D97706";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Early warning: "${milestoneTitle}" — ${riskLabel}`,
    html: `
      <p style="font-weight:bold;color:${riskColor}">${riskLabel}</p>
      <p>A pulse check on the following milestone suggests it may not be on track:</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Milestone</td><td style="padding:6px 0;font-weight:bold">${esc(milestoneTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Period</td><td style="padding:6px 0">${esc(period)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Risk Level</td><td style="padding:6px 0;font-weight:bold;color:${riskColor}">${riskLabel}</td></tr>
      </table>
      <p style="background:#fff7ed;padding:12px;border-left:3px solid ${riskColor};font-style:italic">${esc(aiAssessment)}</p>
      <p style="font-size:13px;color:#666">This is an early warning based on a lightweight data check — not an official attestation run. No blockchain record has been created.</p>
      <p><a href="${enterpriseLink(contractId)}">Review and take action →</a></p>
    `,
  });
}

// ── Phase 3 — Feature VI: Predictive Miss ─────────────────────────────────────

export async function sendPredictiveMissEmail({
  to,
  milestoneTitle,
  contractId,
  predictedOutcome,
  confidence,
  weeksToDeadline,
  lastRawValue,
  targetValue,
}: {
  to: string;
  milestoneTitle: string;
  contractId: string;
  predictedOutcome: "NO" | "INCONCLUSIVE";
  confidence: number;
  weeksToDeadline: number;
  lastRawValue: string | null;
  targetValue: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const color = predictedOutcome === "NO" ? "#ef4444" : "#f59e0b";
  const label = predictedOutcome === "NO" ? "Trending to MISS" : "Trending INCONCLUSIVE";
  const pct = Math.round(confidence * 100);
  const weeks = Math.round(weeksToDeadline * 10) / 10;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `⚠ Predictive Warning: "${milestoneTitle}" is trending to miss`,
    html: `
      <p style="font-weight:bold;color:${color}">Predictive Warning — ${label}</p>
      <p>Based on pulse-check trend data, cascrow predicts this milestone is unlikely to be met on time.</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Milestone</td><td style="padding:6px 0;font-weight:bold">${esc(milestoneTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Predicted Outcome</td><td style="padding:6px 0;font-weight:bold;color:${color}">${label} (${pct}% confidence)</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Time Remaining</td><td style="padding:6px 0">~${weeks} weeks</td></tr>
        ${lastRawValue ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Last Measured Value</td><td style="padding:6px 0">${esc(lastRawValue)}</td></tr>` : ""}
        ${targetValue ? `<tr><td style="padding:6px 0;color:#666;font-size:13px">Target</td><td style="padding:6px 0">${esc(targetValue)}</td></tr>` : ""}
      </table>
      <p style="font-size:13px;color:#666">No blockchain record has been written — this is a private early-warning signal. You have time to course-correct before the official verification date.</p>
      <p><a href="${enterpriseLink(contractId)}">Review milestone →</a></p>
    `,
  });
}

// ── Phase 3 — Feature XI: Multi-Party Consensus ───────────────────────────────

export async function sendConsensusVoteInviteEmail({
  to,
  milestoneTitle,
  contractId,
  partyRole,
  voteToken,
  deadline,
}: {
  to: string;
  milestoneTitle: string;
  contractId: string;
  partyRole: string;
  voteToken: string;
  deadline: Date;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://cascrow.com";
  const voteUrl = `${baseUrl}/vote/${voteToken}`;
  const deadlineStr = deadline.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're invited to verify: "${milestoneTitle}"`,
    html: `
      <p>You have been invited as a <strong>${esc(partyRole)}</strong> to participate in the consensus attestation of the following milestone:</p>
      <p style="font-weight:bold;font-size:1.1em">${esc(milestoneTitle)}</p>
      <p>Your vote is required by <strong>${deadlineStr}</strong>.</p>
      <p>Click below to view the evidence and cast your vote:</p>
      <p><a href="${voteUrl}" style="background:#1D4ED8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">Cast Your Vote →</a></p>
      <p style="font-size:12px;color:#666">This link is unique to you and can only be used once. If you have questions, contact the contract owner.</p>
    `,
  });
}

export async function sendConsensusReachedEmail({
  to,
  milestoneTitle,
  contractId,
  yesVotes,
  totalParties,
  certUrl,
}: {
  to: string;
  milestoneTitle: string;
  contractId: string;
  yesVotes: number;
  totalParties: number;
  certUrl: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Consensus reached: "${milestoneTitle}" VERIFIED`,
    html: `
      <p>The consensus attestation for the following milestone has been completed:</p>
      <p style="font-weight:bold;font-size:1.1em">${esc(milestoneTitle)}</p>
      <p>Result: <strong style="color:#16a34a">VERIFIED</strong> — ${yesVotes} of ${totalParties} parties confirmed.</p>
      ${certUrl ? `<p><a href="${certUrl}">Download Attestation Certificate →</a></p>` : ""}
      <p><a href="${enterpriseLink(contractId)}">View full results →</a></p>
    `,
  });
}

// ── Enterprise Deadline Reminder ──────────────────────────────────────────────

export async function sendAttestationDeadlineReminderEmail({
  to,
  contractId,
  goalSetTitle,
  milestoneTitle,
  deadlineAt,
  daysLeft,
}: {
  to: string;
  contractId: string;
  goalSetTitle: string;
  milestoneTitle: string;
  deadlineAt: Date;
  daysLeft: number;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const deadlineStr = deadlineAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const urgentColor = daysLeft <= 3 ? "#DC2626" : "#D97706";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Attestation deadline in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}: ${milestoneTitle}`,
    html: `
      <p style="font-weight:bold;color:${urgentColor}">⏰ Attestation deadline approaching</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Goal Set</td><td style="padding:6px 0;font-weight:bold">${esc(goalSetTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Milestone</td><td style="padding:6px 0;font-weight:bold">${esc(milestoneTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Deadline</td><td style="padding:6px 0;color:${urgentColor};font-weight:bold">${deadlineStr}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px">Days remaining</td><td style="padding:6px 0;font-weight:bold">${daysLeft}</td></tr>
      </table>
      <p>Run your attestation now to capture this period's data before the deadline expires.</p>
      <p><a href="${enterpriseLink(contractId)}" style="background:#C4704B;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Open Goal Set →</a></p>
      <p style="font-size:12px;color:#999">You are receiving this because you are the owner of this attestation goal set on cascrow.</p>
    `,
  });
}
