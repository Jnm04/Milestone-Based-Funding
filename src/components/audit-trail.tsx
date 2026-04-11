import { AuditLog } from "@prisma/client";
import { IS_MAINNET } from "@/lib/config";

const EVENT_LABELS: Record<string, string> = {
  CONTRACT_CREATED: "Contract Created",
  ESCROW_FUNDED: "Escrow Funded",
  PROOF_SUBMITTED: "Proof Submitted",
  AI_DECISION: "AI Decision",
  FUNDS_RELEASED: "Funds Released",
  ESCROW_CANCELLED: "Escrow Cancelled",
  PROOF_RESUBMITTED: "Proof Resubmitted",
  MANUAL_REVIEW_APPROVED: "Manually Approved",
  MANUAL_REVIEW_REJECTED: "Manually Rejected",
  NFT_MINTED: "NFT Minted",
};

const XRPL_EXPLORER = IS_MAINNET ? "https://xrpscan.com/tx" : "https://testnet.xrpscan.com/tx";
const EVM_EXPLORER = "https://explorer.testnet.xrplevm.org/tx";

export function AuditTrail({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(196,112,75,0.15)",
      }}
    >
      <span
        className="text-xs uppercase tracking-widest font-medium"
        style={{ color: "#C4704B" }}
      >
        On-Chain Audit Trail
      </span>

      <div className="flex flex-col gap-0">
        {logs.map((log, i) => (
          <div key={log.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center" style={{ width: 20 }}>
              <div
                className="rounded-full shrink-0"
                style={{
                  width: 8,
                  height: 8,
                  background: log.xrplTxHash ? "#C4704B" : log.evmTxHash ? "#7c6a5c" : "#52525b",
                  marginTop: 6,
                }}
              />
              {i < logs.length - 1 && (
                <div
                  className="flex-1"
                  style={{
                    width: 1,
                    background: "rgba(196,112,75,0.2)",
                    minHeight: 20,
                    marginTop: 4,
                  }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex items-start justify-between gap-4 pb-4 flex-1 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium" style={{ color: "#EDE6DD" }}>
                  {EVENT_LABELS[log.event] ?? log.event}
                </span>
                {log.actor && log.actor !== "PLATFORM" && log.actor !== "AI" && (
                  <span
                    className="text-xs font-mono truncate"
                    style={{ color: "#A89B8C", maxWidth: 200 }}
                  >
                    {log.actor}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="text-xs" style={{ color: "#A89B8C" }}>
                  {new Date(log.createdAt).toLocaleString()}
                </span>

                {/* Chain explorer links */}
                {log.xrplTxHash ? (
                  <a
                    href={`${XRPL_EXPLORER}/${log.xrplTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono hover:underline"
                    title={log.xrplTxHash}
                    style={{ color: "#C4704B" }}
                  >
                    {log.xrplTxHash.slice(0, 10)}… ↗
                  </a>
                ) : log.evmTxHash ? (
                  <a
                    href={`${EVM_EXPLORER}/${log.evmTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono hover:underline"
                    title={log.evmTxHash}
                    style={{ color: "#C4704B" }}
                  >
                    {log.evmTxHash.slice(0, 10)}… ↗
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: "#52525b" }}>
                    off-chain only
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
