import { Badge } from "@/components/ui/badge";

export interface ModelVote {
  model: string;
  decision: "YES" | "NO";
  confidence: number;
  reasoning: string;
}

interface AIResultProps {
  decision: string;
  reasoning: string;
  confidence: number;
  submittedAt: Date | string;
  modelVotes?: ModelVote[];
}

/** Shortened display names for the 5 models */
const MODEL_LABELS: Record<string, string> = {
  "Claude":        "Claude",
  "Claude Haiku":  "Claude",
  "Gemini":        "Gemini",
  "Gemini Flash":  "Gemini",
  "OpenAI":        "GPT-4o",
  "GPT-4o-mini":   "GPT-4o",
  "Mistral":       "Mistral",
  "Mistral Small": "Mistral",
  "Cerebras/Qwen3":"Cerebras",
};

function shortName(model: string): string {
  return MODEL_LABELS[model] ?? model.split(/[\s/]/)[0];
}

export function AIResult({ decision, reasoning, confidence, submittedAt, modelVotes }: AIResultProps) {
  const isYes = decision === "YES";
  const bg     = isYes ? "rgba(74,222,128,0.07)"  : "rgba(248,113,113,0.07)";
  const border = isYes ? "rgba(74,222,128,0.2)"   : "rgba(248,113,113,0.2)";
  const accent = isYes ? "#6EE09A"                : "#F87171";
  const bar    = isYes ? "#22c55e"                : "#ef4444";

  const yesCount = modelVotes ? modelVotes.filter((v) => v.decision === "YES").length : null;

  return (
    <div className="flex flex-col gap-4 p-5 rounded-xl" style={{ background: bg, border: `1px solid ${border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm" style={{ color: "#EDE6DD" }}>AI Verification</span>
        <Badge variant={isYes ? "default" : "destructive"}>
          {isYes ? "APPROVED" : "REJECTED"}
        </Badge>
      </div>

      {/* Per-model vote grid */}
      {modelVotes && modelVotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "#A89B8C" }}>
              5-Model Vote
            </span>
            <span className="text-xs font-semibold" style={{ color: accent }}>
              {yesCount}/{modelVotes.length} approved
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {modelVotes.map((vote) => {
              const vYes = vote.decision === "YES";
              return (
                <div
                  key={vote.model}
                  title={`${vote.model}: ${vote.decision} (${vote.confidence}%)\n${vote.reasoning}`}
                  style={{
                    padding: "6px 4px",
                    borderRadius: "8px",
                    background: vYes ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    border: `1px solid ${vYes ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "3px",
                    cursor: "default",
                  }}
                >
                  <span style={{ fontSize: "10px", fontWeight: 600, color: vYes ? "#6EE09A" : "#F87171" }}>
                    {vYes ? "YES" : "NO"}
                  </span>
                  <span style={{ fontSize: "9px", color: "#A89B8C", textAlign: "center", lineHeight: 1.2 }}>
                    {shortName(vote.model)}
                  </span>
                  <span style={{ fontSize: "9px", color: vYes ? "#6EE09A" : "#F87171", opacity: 0.75 }}>
                    {vote.confidence}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aggregate confidence bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#A89B8C" }}>Consensus confidence</span>
          <span className="text-sm font-medium" style={{ color: accent }}>{confidence}%</span>
        </div>
        <div className="flex-1 rounded-full h-2" style={{ background: "rgba(255,255,255,0.1)" }}>
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${confidence}%`, background: bar }}
          />
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm leading-relaxed" style={{ color: "#EDE6DD" }}>{reasoning}</p>

      <p className="text-xs" style={{ color: "#6B5E52" }}>
        Verified at {new Date(submittedAt).toLocaleString()}
      </p>
    </div>
  );
}
