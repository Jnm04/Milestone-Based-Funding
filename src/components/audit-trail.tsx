import { AuditLog } from "@prisma/client";
import { IS_MAINNET } from "@/lib/config";

const EVENT_LABELS: Record<string, string> = {
  CONTRACT_CREATED:        "Contract Created",
  ESCROW_FUNDED:           "Escrow Funded",
  PROOF_SUBMITTED:         "Proof Submitted",
  AI_DECISION:             "AI Verified",
  FUNDS_RELEASED:          "Funds Released",
  ESCROW_CANCELLED:        "Escrow Cancelled",
  PROOF_RESUBMITTED:       "Proof Resubmitted",
  MANUAL_REVIEW_APPROVED:  "Manually Approved",
  MANUAL_REVIEW_REJECTED:  "Manually Rejected",
  NFT_MINTED:              "NFT Minted",
};

// Events that are escrow-specific and should be hidden for verification-only contracts
const ESCROW_ONLY_EVENTS = new Set(["FUNDS_RELEASED", "ESCROW_FUNDED", "ESCROW_CANCELLED"]);

const EVENT_COLORS: Record<string, string> = {
  CONTRACT_CREATED:       "hsl(22 55% 54%)",
  AI_DECISION:            "#6EE09A",
  FUNDS_RELEASED:         "#6EE09A",
  MANUAL_REVIEW_APPROVED: "#6EE09A",
  ESCROW_CANCELLED:       "#F87171",
  MANUAL_REVIEW_REJECTED: "#F87171",
  NFT_MINTED:             "hsl(22 55% 64%)",
};

const XRPL_EXPLORER = IS_MAINNET ? "https://xrpscan.com/tx" : "https://testnet.xrpscan.com/tx";

interface AuditTrailProps {
  logs: AuditLog[];
  milestones?: { id: string; title: string; order: number }[];
  isVerificationOnly?: boolean;
}

export function AuditTrail({ logs, milestones = [], isVerificationOnly = false }: AuditTrailProps) {
  if (logs.length === 0) return null;

  // Filter escrow-only events for verification contracts
  const filtered = isVerificationOnly
    ? logs.filter((l) => !ESCROW_ONLY_EVENTS.has(l.event))
    : logs;

  if (filtered.length === 0) return null;

  // Sort ascending by time
  const sorted = [...filtered].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Group: contract-level logs (no milestoneId) first, then per milestone
  const contractLogs = sorted.filter((l) => !l.milestoneId);
  const milestoneLogs = sorted.filter((l) => l.milestoneId);

  // Build milestone groups in order
  const milestoneMap = new Map<string, { title: string; order: number; logs: AuditLog[] }>();

  // Pre-populate from milestones prop so we have titles
  milestones.forEach((m) => {
    milestoneMap.set(m.id, { title: m.title, order: m.order, logs: [] });
  });

  // Add logs to their milestone group
  milestoneLogs.forEach((l) => {
    if (!milestoneMap.has(l.milestoneId!)) {
      milestoneMap.set(l.milestoneId!, { title: `Milestone`, order: 99, logs: [] });
    }
    milestoneMap.get(l.milestoneId!)!.logs.push(l);
  });

  const milestoneGroups = [...milestoneMap.entries()]
    .filter(([, g]) => g.logs.length > 0)
    .sort(([, a], [, b]) => a.order - b.order);

  const renderLog = (log: AuditLog, i: number, arr: AuditLog[]) => {
    const isLast = i === arr.length - 1;
    const color = EVENT_COLORS[log.event] ?? "hsl(32 35% 92%)";

    return (
      <div key={log.id} className="flex gap-3">
        <div className="flex flex-col items-center" style={{ width: 20 }}>
          <div
            className="rounded-full shrink-0"
            style={{
              width: 7,
              height: 7,
              background: log.xrplTxHash || log.evmTxHash ? "hsl(22 55% 54%)" : "hsl(28 18% 28%)",
              marginTop: 6,
            }}
          />
          {!isLast && (
            <div
              className="flex-1"
              style={{ width: 1, background: "hsl(22 55% 54% / 0.15)", minHeight: 16, marginTop: 3 }}
            />
          )}
        </div>

        <div className="flex items-start justify-between gap-4 pb-3 flex-1 text-sm">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium" style={{ color }}>
              {EVENT_LABELS[log.event] ?? log.event}
            </span>
            {log.actor && !["PLATFORM", "AI", "SYSTEM"].includes(log.actor) && (
              <span className="text-xs font-mono truncate" style={{ color: "hsl(30 10% 50%)", maxWidth: 200 }}>
                {log.actor}
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs" style={{ color: "hsl(30 10% 50%)" }}>
              {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            <div className="flex flex-col items-end gap-0.5">
              {log.evmTxHash && (
                <span className="text-xs font-mono" title={log.evmTxHash} style={{ color: "hsl(30 10% 45%)" }}>
                  EVM {log.evmTxHash.slice(0, 10)}…
                </span>
              )}
              {log.xrplTxHash && (
                <a
                  href={`${XRPL_EXPLORER}/${log.xrplTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono hover:underline"
                  title={`XRPL: ${log.xrplTxHash}`}
                  style={{ color: "hsl(22 55% 54%)" }}
                >
                  XRPL {log.xrplTxHash.slice(0, 8)}… ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col gap-4 p-5 rounded-2xl"
      style={{
        background: "hsl(24 12% 6% / 0.5)",
        border: "1px solid hsl(22 55% 54% / 0.15)",
      }}
    >
      <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "hsl(22 55% 54%)" }}>
        On-Chain Audit Trail
      </span>

      {/* Contract-level events */}
      {contractLogs.length > 0 && (
        <div className="flex flex-col gap-0">
          {contractLogs.map((l, i) => renderLog(l, i, contractLogs))}
        </div>
      )}

      {/* Per-milestone groups */}
      {milestoneGroups.map(([, group], gi) => (
        <div key={gi} className="flex flex-col gap-1">
          <div
            className="text-xs font-mono uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: "hsl(22 55% 54% / 0.08)",
              color: "hsl(22 55% 54%)",
              border: "1px solid hsl(22 55% 54% / 0.15)",
              letterSpacing: "0.12em",
            }}
          >
            Milestone {gi + 1} — {group.title.length > 50 ? group.title.slice(0, 50) + "…" : group.title}
          </div>
          <div className="flex flex-col gap-0 pl-1 pt-1">
            {group.logs.map((l, i) => renderLog(l, i, group.logs))}
          </div>
        </div>
      ))}
    </div>
  );
}
