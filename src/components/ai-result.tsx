import { Badge } from "@/components/ui/badge";

interface AIResultProps {
  decision: string;
  reasoning: string;
  confidence: number;
  submittedAt: Date | string;
}

export function AIResult({ decision, reasoning, confidence, submittedAt }: AIResultProps) {
  const isYes = decision === "YES";

  return (
    <div
      className={`flex flex-col gap-4 p-5 rounded-xl border ${
        isYes ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">AI Verification Result</span>
        <Badge variant={isYes ? "default" : "destructive"}>
          {isYes ? "APPROVED" : "REJECTED"}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-zinc-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isYes ? "bg-green-500" : "bg-red-500"}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className="text-sm font-medium w-12 text-right">{confidence}%</span>
      </div>

      <p className="text-sm text-zinc-700 leading-relaxed">{reasoning}</p>

      <p className="text-xs text-zinc-400">
        Verified at {new Date(submittedAt).toLocaleString()} by Claude AI
      </p>
    </div>
  );
}
