import { getPlatformSigner } from "@/services/evm/client";
import { writeXrplAuditMemo } from "@/services/xrpl/audit-xrpl.service";
import { prisma } from "@/lib/prisma";

export type AuditEvent =
  | "CONTRACT_CREATED"
  | "ESCROW_FUNDED"
  | "PROOF_SUBMITTED"
  | "AI_DECISION"
  | "FUNDS_RELEASED"
  | "ESCROW_CANCELLED"
  | "PROOF_RESUBMITTED"
  | "MANUAL_REVIEW_APPROVED"
  | "MANUAL_REVIEW_REJECTED"
  | "NFT_MINTED";

interface AuditParams {
  contractId: string;
  milestoneId?: string;
  event: AuditEvent;
  actor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an immutable audit entry to both the XRPL EVM sidechain and the
 * native XRP Ledger (as a memo transaction), then saves to DB.
 * Never throws — audit failures are logged but never break the main flow.
 * Use with void: `void writeAuditLog({ ... })`
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  // Write to both chains in parallel — neither blocks the other
  const [evmTxHash, xrplTxHash] = await Promise.all([
    (async (): Promise<string | null> => {
      try {
        const signer = getPlatformSigner();
        const payload = JSON.stringify({
          app: "cascrow",
          v: 1,
          event: params.event,
          contractId: params.contractId,
          milestoneId: params.milestoneId ?? null,
          actor: params.actor ?? "PLATFORM",
          metadata: params.metadata ?? {},
          ts: new Date().toISOString(),
        });
        const tx = await signer.sendTransaction({
          to: await signer.getAddress(),
          value: 0,
          data: "0x" + Buffer.from(payload).toString("hex"),
        });
        return tx.hash;
      } catch (err) {
        console.error("[audit] EVM write failed:", err);
        return null;
      }
    })(),
    writeXrplAuditMemo({
      event: params.event,
      contractId: params.contractId,
      milestoneId: params.milestoneId ?? null,
      actor: params.actor,
      metadata: params.metadata,
    }),
  ]);

  try {
    await prisma.auditLog.create({
      data: {
        contractId: params.contractId,
        milestoneId: params.milestoneId ?? null,
        event: params.event,
        evmTxHash,
        xrplTxHash,
        actor: params.actor ?? "PLATFORM",
        metadata: JSON.parse(JSON.stringify(params.metadata ?? {})),
      },
    });
  } catch (err) {
    console.error("[audit] DB write failed:", err);
  }
}
