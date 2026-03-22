import { Badge } from "@/components/ui/badge";
import { ContractStatus } from "@/types";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT:           { label: "Draft",            variant: "outline" },
  AWAITING_ESCROW: { label: "Awaiting Escrow",  variant: "secondary" },
  FUNDED:          { label: "Funded",           variant: "default" },
  PROOF_SUBMITTED: { label: "Proof Submitted",  variant: "secondary" },
  PENDING_REVIEW:  { label: "Manuelle Prüfung", variant: "secondary" },
  VERIFIED:        { label: "Verified — AI Approved", variant: "default" },
  REJECTED:        { label: "Rejected",          variant: "destructive" },
  DECLINED:        { label: "Einladung abgelehnt", variant: "destructive" },
  EXPIRED:         { label: "Expired",          variant: "destructive" },
  COMPLETED:       { label: "Completed",        variant: "default" },
};

interface EscrowStatusProps {
  status: ContractStatus;
  escrowSequence?: number | null;
  amountRLUSD?: string | null;
  cancelAfter: Date | string;
}

export function EscrowStatus({
  status,
  escrowSequence,
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
          <span className="font-semibold">{amountRLUSD} RLUSD</span>
        </div>
      )}

      {escrowSequence && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">Escrow Sequence</span>
          <code className="text-xs font-mono">{escrowSequence}</code>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-500">Deadline</span>
        <span className={`text-sm font-medium ${daysLeft < 3 ? "text-red-500" : ""}`}>
          {deadline.toLocaleDateString()} ({daysLeft > 0 ? `${daysLeft}d left` : "expired"})
        </span>
      </div>
    </div>
  );
}
