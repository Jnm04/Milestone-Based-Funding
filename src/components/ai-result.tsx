import { Badge } from "@/components/ui/badge";

interface AIResultProps {
  decision: string;
  reasoning: string;
  confidence: number;
  submittedAt: Date | string;
}

export function AIResult({ decision, reasoning, confidence, submittedAt }: AIResultProps) {
  const isYes = decision === "YES";

  const bg    = isYes ? "rgba(74,222,128,0.07)"  : "rgba(248,113,113,0.07)";
  const border = isYes ? "rgba(74,222,128,0.2)"   : "rgba(248,113,113,0.2)";
  const accent = isYes ? "#6EE09A"                : "#F87171";
  const bar    = isYes ? "#22c55e"                : "#ef4444";

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>AI Verification Result</span>
        <Badge variant={isYes ? "default" : "destructive"}>
          {isYes ? "APPROVED" : "REJECTED"}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-full h-2" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${confidence}%`, background: bar }}
          />
        </div>
        <span className="text-sm font-medium w-12 text-right" style={{ color: accent }}>{confidence}%</span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "#EDE6DD" }}>{reasoning}</p>

      <p className="text-xs" style={{ color: "#6B5E52" }}>
        Verified at {new Date(submittedAt).toLocaleString()}
      </p>
    </div>
  );
}
