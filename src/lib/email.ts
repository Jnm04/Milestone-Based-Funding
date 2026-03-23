import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "MilestoneFund <onboarding@resend.dev>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function contractLink(contractId: string) {
  return `${BASE_URL}/contract/${contractId}`;
}

// ── Investor notifications ──────────────────────────────────────────────────

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
    subject: `Beweis eingereicht: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p><strong>${startupName ?? "Das Startup"}</strong> hat einen Beweis für den Milestone <strong>${milestoneTitle}</strong> eingereicht.</p>
      <p>Die KI-Verifikation läuft automatisch. Du wirst benachrichtigt, sobald eine manuelle Prüfung erforderlich ist.</p>
      <p><a href="${contractLink(contractId)}">Contract öffnen →</a></p>
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
    subject: `Manuelle Prüfung erforderlich: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p>Die KI ist beim Milestone <strong>${milestoneTitle}</strong> unsicher und benötigt deine manuelle Prüfung.</p>
      ${aiReasoning ? `<p><em>KI-Begründung: ${aiReasoning}</em></p>` : ""}
      <p><a href="${contractLink(contractId)}">Jetzt prüfen →</a></p>
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
    subject: `Milestone abgeschlossen: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p>Der Milestone <strong>${milestoneTitle}</strong> wurde erfolgreich abgeschlossen. Die Zahlung von <strong>$${Number(amountUSD).toLocaleString("de-DE")} RLUSD</strong> wurde freigegeben.</p>
      <p><a href="${contractLink(contractId)}">Contract ansehen →</a></p>
    `,
  });
}

// ── Startup notifications ───────────────────────────────────────────────────

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
    subject: `Milestone finanziert: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p>Dein Milestone <strong>${milestoneTitle}</strong> wurde mit <strong>$${Number(amountUSD).toLocaleString("de-DE")} RLUSD</strong> finanziert.</p>
      <p>Du kannst jetzt Beweise hochladen, um die Freigabe der Zahlung zu starten.</p>
      <p><a href="${contractLink(contractId)}">Beweis hochladen →</a></p>
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
    subject: `Zahlung freigegeben: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p>Glückwunsch! Der Beweis für <strong>${milestoneTitle}</strong> wurde genehmigt. <strong>$${Number(amountUSD).toLocaleString("de-DE")} RLUSD</strong> wurden an deine Wallet überwiesen.</p>
      ${txHash ? `<p>Transaktion: <code>${txHash}</code></p>` : ""}
      <p><a href="${contractLink(contractId)}">Contract ansehen →</a></p>
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
    subject: `Beweis abgelehnt: ${milestoneTitle}`,
    html: `
      <p>Hallo,</p>
      <p>Dein Beweis für <strong>${milestoneTitle}</strong> wurde von der KI abgelehnt.</p>
      ${aiReasoning ? `<p><strong>Begründung:</strong> ${aiReasoning}</p>` : ""}
      <p>Du kannst einen neuen Beweis einreichen, solange die Deadline nicht abgelaufen ist.</p>
      <p><a href="${contractLink(contractId)}">Erneut einreichen →</a></p>
    `,
  });
}
