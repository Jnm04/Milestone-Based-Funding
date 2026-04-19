import { Badge } from "@/components/ui/badge";
import { ContractStatus } from "@/types";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:           { label: "Draft",                  variant: "outline" },
  AWAITING_ESCROW: { label: "Awaiting Escrow",        variant: "secondary" },
  FUNDED:          { label: "Funded",                 variant: "default" },
  PROOF_SUBMITTED: { label: "Proof Submitted",        variant: "secondary" },
  PENDING_REVIEW:  { label: "Pending Review",          variant: "secondary" },
  VERIFIED:        { label: "Verified — AI Approved", variant: "default" },
  REJECTED:        { label: "Rejected",               variant: "destructive" },
  DECLINED:        { label: "Invitation Declined",    variant: "destructive" },
  RENEGOTIATING:   { label: "Renegotiating",          variant: "secondary" },
  EXPIRED:         { label: "Expired",                variant: "destructive" },
  COMPLETED:       { label: "Completed",              variant: "default" },
};

interface EscrowStatusProps {
  status: ContractStatus;
  evmTxHash?: string | null;
  amountRLUSD?: string | null;
  cancelAfter: Date | string;
}

export function EscrowStatus({
  status,
  evmTxHash,
  amountRLUSD,
  cancelAfter,
}: EscrowStatusProps) {
  const config = STATUS_CONFIG[status];
  const deadline = new Date(cancelAfter);
  const now = new Date();
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(196,112,75,0.15)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#A89B8C" }}>Escrow Status</span>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      {amountRLUSD && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "#A89B8C" }}>Amount Locked</span>
          <span className="font-semibold" style={{ color: "#EDE6DD" }}>{amountRLUSD} RLUSD</span>
        </div>
      )}

      {evmTxHash && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm shrink-0" style={{ color: "#A89B8C" }}>Fund Tx</span>
          <code className="text-xs font-mono text-right break-all" style={{ color: "#A89B8C" }}>
            {evmTxHash.slice(0, 12)}…{evmTxHash.slice(-8)}
          </code>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: "#A89B8C" }}>Deadline</span>
        <span className="text-sm font-medium" style={{ color: daysLeft < 3 ? "#F87171" : "#EDE6DD" }}>
          {deadline.toLocaleDateString()} ({daysLeft > 0 ? `${daysLeft}d left` : "expired"})
        </span>
      </div>
    </div>
  );
}
