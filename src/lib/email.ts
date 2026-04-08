import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Cascrow <onboarding@resend.dev>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

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
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  startupName?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof submitted: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p><strong>${startupName ?? "The Receiver"}</strong> has submitted proof for the milestone <strong>${milestoneTitle}</strong>.</p>
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
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Manual review required: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>The AI was uncertain about milestone <strong>${milestoneTitle}</strong> and needs your manual review.</p>
      ${aiReasoning ? `<p><em>AI reasoning: ${aiReasoning}</em></p>` : ""}
      <p><a href="${contractLink(contractId)}">Review now →</a></p>
    `,
  });
}

export async function sendMilestoneCompletedInvestorEmail({
  to,
  contractId,
  milestoneTitle,
  amountUSD,
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone completed: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Milestone <strong>${milestoneTitle}</strong> has been successfully completed. The payment of <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been released.</p>
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
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Milestone funded: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Your milestone <strong>${milestoneTitle}</strong> has been funded with <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong>.</p>
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
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  amountUSD: string;
  txHash?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Payment released: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Congratulations! Your proof for <strong>${milestoneTitle}</strong> has been approved. <strong>$${Number(amountUSD).toLocaleString()} RLUSD</strong> has been sent to your wallet.</p>
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
}: {
  to: string;
  contractId: string;
  milestoneTitle: string;
  aiReasoning?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Proof rejected: ${milestoneTitle}`,
    html: `
      <p>Hi,</p>
      <p>Your proof for <strong>${milestoneTitle}</strong> was rejected by the AI.</p>
      ${aiReasoning ? `<p><strong>Reason:</strong> ${aiReasoning}</p>` : ""}
      <p>You can submit new proof as long as the deadline has not passed.</p>
      <p><a href="${contractLink(contractId)}">Resubmit →</a></p>
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
      <p>Your milestone <strong>${milestoneTitle}</strong> has been approved. Payment is being automatically released to your wallet.</p>
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
