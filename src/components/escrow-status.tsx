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
    <div className="flex flex-col gap-3 p-5 rounded-xl border bg-white">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500">Escrow Status</span>
        <Badge variant={config.variant}>{config.label}</Badge>
      </div>

      {amountRLUSD && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">Amount Locked</span>
          <span className="font-semibold text-zinc-900">{amountRLUSD} RLUSD</span>
        </div>
      )}

      {evmTxHash && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-500 shrink-0">Fund Tx</span>
          <code className="text-xs font-mono text-right break-all text-zinc-600">
            {evmTxHash.slice(0, 12)}…{evmTxHash.slice(-8)}
          </code>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Deadline</span>
        <span className={`text-sm font-medium ${daysLeft < 3 ? "text-red-500" : "text-zinc-900"}`}>
          {deadline.toLocaleDateString()} ({daysLeft > 0 ? `${daysLeft}d left` : "expired"})
        </span>
      </div>
    </div>
  );
}
