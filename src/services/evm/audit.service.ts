import { getPlatformSigner } from "@/services/evm/client";
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
  | "MANUAL_REVIEW_REJECTED";

interface AuditParams {
  contractId: string;
  milestoneId?: string;
  event: AuditEvent;
  actor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an immutable audit entry to the XRPL EVM chain and saves it to the DB.
 * Never throws — audit failures are logged but never break the main flow.
 * Use with void: `void writeAuditLog({ ... })`
 */
export async function writeAuditLog(params: AuditParams): Promise<void> {
  let evmTxHash: string | null = null;

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
    evmTxHash = tx.hash;
    // Don't await tx.wait() — we record the hash immediately without blocking
  } catch (err) {
    console.error("[audit] EVM write failed:", err);
    // Continue — DB record is still written without an on-chain hash
  }

  try {
    await prisma.auditLog.create({
      data: {
        contractId: params.contractId,
        milestoneId: params.milestoneId ?? null,
        event: params.event,
        evmTxHash,
        actor: params.actor ?? "PLATFORM",
        // JSON.parse/stringify converts Record<string, unknown> to a Prisma-compatible JsonValue
        metadata: JSON.parse(JSON.stringify(params.metadata ?? {})),
      },
    });
  } catch (err) {
    console.error("[audit] DB write failed:", err);
  }
}
