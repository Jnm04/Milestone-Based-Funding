import { Resend } from "resend";
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof submitted: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${esc(startupName) || "The Receiver"}</strong> has submitted proof for the milestone <strong>${esc(milestoneTitle)}</strong>.</p>
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone completed: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Milestone <strong>${esc(milestoneTitle)}</strong> has been successfully completed. The payment of <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been released.</p>
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone funded: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Your milestone <strong>${esc(milestoneTitle)}</strong> has been funded with <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong>.</p>
      <p>You can now upload proof to trigger the payment release.</p>
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payment released: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Congratulations! Your proof for <strong>${esc(milestoneTitle)}</strong> has been approved. <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been sent to your wallet.</p>
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof rejected: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Your proof for <strong>${esc(milestoneTitle)}</strong> was rejected by the AI.</p>
      ${aiReasoning ? `<p><strong>Reason:</strong> ${esc(aiReasoning)}</p>` : ""}
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
